import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  User,
  Session,
  InvestigationCase,
  Investigation,
  ApiKey,
  AuditEvent,
} from "./types";

// Simple, dependency-free JSON datastore. One file per collection.
// Serializes writes per-collection via an in-process promise chain.
// Suitable for single-node self-hosted deployments; swap for Postgres in prod.

const DATA_DIR = path.join(process.cwd(), "data");

interface Schema {
  users: User[];
  sessions: Session[];
  cases: InvestigationCase[];
  investigations: Investigation[];
  apikeys: ApiKey[];
  audit: AuditEvent[];
}

type CollectionName = keyof Schema;

const DEFAULTS: Schema = {
  users: [],
  sessions: [],
  cases: [],
  investigations: [],
  apikeys: [],
  audit: [],
};

const cache = new Map<CollectionName, unknown[]>();
const writeChains = new Map<CollectionName, Promise<void>>();

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(name: CollectionName) {
  return path.join(DATA_DIR, `${name}.json`);
}

function load<N extends CollectionName>(name: N): Schema[N] {
  if (cache.has(name)) return cache.get(name) as Schema[N];
  ensureDir();
  const fp = filePath(name);
  let data: unknown[] = DEFAULTS[name] as unknown[];
  try {
    if (fs.existsSync(fp)) {
      const txt = fs.readFileSync(fp, "utf8");
      data = JSON.parse(txt);
      if (!Array.isArray(data)) data = DEFAULTS[name] as unknown[];
    }
  } catch {
    data = DEFAULTS[name] as unknown[];
  }
  cache.set(name, data);
  return data as Schema[N];
}

function persist<N extends CollectionName>(name: N): Promise<void> {
  const prev = writeChains.get(name) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          ensureDir();
          const data = cache.get(name) ?? [];
          const tmp = filePath(name) + ".tmp";
          fs.writeFile(tmp, JSON.stringify(data, null, 2), (err) => {
            if (err) return reject(err);
            fs.rename(tmp, filePath(name), (err2) =>
              err2 ? reject(err2) : resolve()
            );
          });
        })
    );
  writeChains.set(name, next);
  return next;
}

export function uid(prefix = ""): string {
  return prefix + crypto.randomBytes(12).toString("hex");
}

export const db = {
  all<N extends CollectionName>(name: N): Schema[N] {
    return load(name);
  },
  find<N extends CollectionName>(
    name: N,
    pred: (row: Schema[N][number]) => boolean
  ): Schema[N][number] | undefined {
    return (load(name) as Schema[N][number][]).find(pred);
  },
  filter<N extends CollectionName>(
    name: N,
    pred: (row: Schema[N][number]) => boolean
  ): Schema[N][number][] {
    return (load(name) as Schema[N][number][]).filter(pred);
  },
  async insert<N extends CollectionName>(
    name: N,
    row: Schema[N][number]
  ): Promise<Schema[N][number]> {
    const arr = load(name) as Schema[N][number][];
    arr.push(row);
    await persist(name);
    return row;
  },
  async update<N extends CollectionName>(
    name: N,
    id: string,
    patch: Partial<Schema[N][number]>
  ): Promise<Schema[N][number] | undefined> {
    const arr = load(name) as (Schema[N][number] & { id: string })[];
    const idx = arr.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    arr[idx] = { ...arr[idx], ...patch };
    await persist(name);
    return arr[idx];
  },
  async remove<N extends CollectionName>(name: N, id: string): Promise<boolean> {
    const arr = load(name) as (Schema[N][number] & { id: string })[];
    const idx = arr.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    await persist(name);
    return true;
  },
};

export async function audit(
  action: string,
  actorId: string | null,
  target?: string,
  meta?: Record<string, unknown>
) {
  await db.insert("audit", {
    id: uid("ev_"),
    at: new Date().toISOString(),
    actorId,
    action,
    target,
    meta,
  });
}
