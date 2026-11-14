/**
 * Versioned SQL migrations. Files in ./migrations named NNN_name.sql are
 * applied in order inside a transaction, guarded by an advisory lock so two
 * instances starting at once cannot race. Applied files are checksummed; an
 * edited, already-applied migration aborts startup instead of drifting.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Connection, PgConfig, configFromUrl } from "./pg.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.MIGRATIONS_DIR ?? [path.join(HERE, "migrations"), path.join(HERE, "_migrations")].find((d) => fs.existsSync(d)) ?? path.join(HERE, "migrations");
const LOCK_KEY = 7_420_421_337;

export async function migrate(cfg: PgConfig, log: (s: string) => void = console.log): Promise<string[]> {
  const c = new Connection(cfg);
  await c.connect();
  const applied: string[] = [];
  try {
    await c.simple(`SELECT pg_advisory_lock(${LOCK_KEY})`);
    await c.simple(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Map(
      (await c.query<{ version: string; checksum: string }>("SELECT version, checksum FROM schema_migrations")).rows.map((r) => [r.version, r.checksum]),
    );
    const files = fs.readdirSync(DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(DIR, f), "utf8");
      const sum = crypto.createHash("sha256").update(sql).digest("hex");
      const prev = done.get(f);
      if (prev) {
        if (prev !== sum) throw new Error(`Migration ${f} was modified after being applied`);
        continue;
      }
      log(`applying ${f}`);
      await c.simple("BEGIN");
      try {
        await c.simple(sql);
        await c.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [f, sum]);
        await c.simple("COMMIT");
      } catch (e) {
        await c.simple("ROLLBACK");
        throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
      }
      applied.push(f);
    }
  } finally {
    try { await c.simple(`SELECT pg_advisory_unlock(${LOCK_KEY})`); } catch {}
    c.close();
  }
  return applied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }
  migrate(configFromUrl(url)).then((a) => { console.log(a.length ? `applied ${a.length}` : "up to date"); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
