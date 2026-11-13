/**
 * Password hashing with Argon2id, run on a worker pool so a ~1s hash never
 * blocks the HTTP event loop. Hashes use the standard PHC string format so
 * they are portable to libargon2 / any other implementation.
 */
import { Worker } from "node:worker_threads";
import crypto from "node:crypto";
import os from "node:os";

// OWASP 2024 recommendation for Argon2id.
export const DEFAULT_PARAMS = { m: 19456, t: 2, p: 1, len: 32 };

type Job = { resolve: (h: Uint8Array) => void; reject: (e: Error) => void };

class HashPool {
  private workers: Worker[] = [];
  private jobs = new Map<number, Job>();
  private next = 0;
  private rr = 0;

  private ensure() {
    if (this.workers.length) return;
    const n = Math.max(1, Math.min(4, os.cpus().length));
    const url = new URL(import.meta.url.endsWith(".ts") ? "./argon2-worker.ts" : "./argon2-worker.js", import.meta.url);
    for (let i = 0; i < n; i++) {
      const w = new Worker(url);
      w.unref();
      w.on("message", (m: { id: number; hash?: Uint8Array; error?: string }) => {
        const job = this.jobs.get(m.id);
        if (!job) return;
        this.jobs.delete(m.id);
        if (m.error) job.reject(new Error(m.error)); else job.resolve(m.hash!);
      });
      w.on("error", (e: Error) => {
        for (const [, j] of this.jobs) j.reject(e);
        this.jobs.clear();
        this.workers = [];
      });
      this.workers.push(w);
    }
  }

  run(password: Uint8Array, salt: Uint8Array, prm: typeof DEFAULT_PARAMS): Promise<Uint8Array> {
    this.ensure();
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.jobs.set(id, { resolve, reject });
      this.workers[this.rr++ % this.workers.length].postMessage({ id, password, salt, ...prm });
    });
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
  }
}

const pool = new HashPool();
export const closeHashPool = () => pool.close();

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64").replace(/=+$/, "");
const unb64 = (s: string) => Buffer.from(s, "base64");

export const MAX_PASSWORD_BYTES = 256;

export async function hashPassword(password: string, prm = DEFAULT_PARAMS): Promise<string> {
  const pw = Buffer.from(password.normalize("NFKC"), "utf8");
  if (pw.length > MAX_PASSWORD_BYTES) throw new Error("password too long");
  const salt = crypto.randomBytes(16);
  const hash = await pool.run(pw, salt, prm);
  return `$argon2id$v=19$m=${prm.m},t=${prm.t},p=${prm.p}$${b64(salt)}$${b64(hash)}`;
}

function parse(phc: string) {
  const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(phc);
  if (!m) return null;
  const hash = unb64(m[5]);
  return { m: +m[1], t: +m[2], p: +m[3], salt: unb64(m[4]), hash, len: hash.length };
}

export async function verifyPassword(phc: string, password: string): Promise<boolean> {
  const parsed = parse(phc);
  if (!parsed) return false;
  const pw = Buffer.from(password.normalize("NFKC"), "utf8");
  if (pw.length > MAX_PASSWORD_BYTES) return false;
  const got = await pool.run(pw, parsed.salt, parsed);
  return got.length === parsed.hash.length && crypto.timingSafeEqual(Buffer.from(got), parsed.hash);
}

export function needsRehash(phc: string, prm = DEFAULT_PARAMS): boolean {
  const p = parse(phc);
  return !p || p.m < prm.m || p.t < prm.t || p.len !== prm.len;
}

/**
 * A real hash of a random value, used to equalise login timing when the
 * account doesn't exist (prevents user enumeration by response time).
 */
let dummy: Promise<string> | null = null;
export async function burnVerify(password: string) {
  dummy ??= hashPassword(crypto.randomBytes(16).toString("hex"));
  await verifyPassword(await dummy, password);
}
