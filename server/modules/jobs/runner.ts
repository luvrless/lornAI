/**
 * Postgres-backed job queue. Jobs are claimed with FOR UPDATE SKIP LOCKED so
 * multiple workers never run the same job; a job whose worker died is
 * reclaimed after a lease timeout. Idempotency keys dedupe enqueues.
 */
import os from "node:os";
import type { App, Queryable } from "../../app.ts";
import { asJson } from "../../db/pg.ts";

export type JobHandler = (app: App, payload: any, job: { id: number; attempts: number }) => Promise<void>;
const handlers = new Map<string, JobHandler>();
export const registerJob = (kind: string, h: JobHandler) => handlers.set(kind, h);

export async function enqueue(db: Queryable, kind: string, payload: object = {}, o: { runAt?: Date; idempotencyKey?: string; maxAttempts?: number } = {}) {
  const r = await db.query<{ id: number }>(
    `INSERT INTO jobs (kind, payload, run_at, idempotency_key, max_attempts) VALUES ($1,$2,COALESCE($3, now()),$4,$5)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [kind, asJson(payload), o.runAt ?? null, o.idempotencyKey ?? null, o.maxAttempts ?? 5]);
  return r.rows[0]?.id ?? null;
}

const LEASE_SEC = 300;

/** Claim and run one ready job. Returns false when the queue is empty. */
export async function runOne(app: App, workerId = `${os.hostname()}:${process.pid}`): Promise<boolean> {
  const job = (await app.db.query(
    `UPDATE jobs SET status = 'running', locked_at = now(), locked_by = $1, attempts = attempts + 1
     WHERE id = (
       SELECT id FROM jobs
       WHERE (status = 'queued' AND run_at <= now()) OR (status = 'running' AND locked_at < now() - make_interval(secs => $2))
       ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING id, kind, payload, attempts, max_attempts`, [workerId, LEASE_SEC])).rows[0];
  if (!job) return false;
  const h = handlers.get(job.kind);
  try {
    if (!h) throw new Error(`No handler for job kind ${job.kind}`);
    await h(app, job.payload, { id: job.id, attempts: job.attempts });
    await app.db.query("UPDATE jobs SET status = 'done', finished_at = now(), last_error = NULL WHERE id = $1", [job.id]);
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 2000) ?? String(e);
    const dead = job.attempts >= job.max_attempts;
    await app.db.query(
      `UPDATE jobs SET status = $2, last_error = $3, run_at = now() + make_interval(secs => $4), locked_at = NULL WHERE id = $1`,
      [job.id, dead ? "dead" : "queued", msg, Math.min(3600, 2 ** job.attempts * 5)]);
    app.log.warn("job failed", { id: job.id, kind: job.kind, attempt: job.attempts, dead, err: msg });
  }
  return true;
}

/** Drain the queue (tests and the worker loop). */
export async function drain(app: App, max = 1000) {
  let n = 0;
  while (n < max && (await runOne(app))) n++;
  return n;
}

type Tick = (app: App) => Promise<void>;
const ticks: { name: string; every: number; fn: Tick; last: number }[] = [];
/** Register a periodic task. `name` must be stable: it's the key the run is claimed under. */
export const every = (ms: number, name: string, fn: Tick) => ticks.push({ name, every: ms, fn, last: 0 });

/** Atomically claim a tick's run for this interval; false if another instance already ran it. */
async function claimTick(app: App, name: string, everyMs: number) {
  const r = await app.db.query(
    `INSERT INTO tick_runs (name, last_at) VALUES ($1, now())
     ON CONFLICT (name) DO UPDATE SET last_at = now()
     WHERE tick_runs.last_at <= now() - make_interval(secs => $2::double precision / 1000)
     RETURNING name`, [name, everyMs]);
  return r.rowCount === 1;
}

/** Run every tick that is due (checked locally first, then claimed in the database). */
export async function runDueTicks(app: App) {
  const now = Date.now();
  for (const t of ticks) {
    if (now - t.last < t.every) continue;
    t.last = now;
    try {
      if (await claimTick(app, t.name, t.every)) await t.fn(app);
    } catch (e) { app.log.error("tick failed", { tick: t.name, err: (e as Error).message }); }
  }
}

export function startWorker(app: App) {
  let stopped = false;
  const loop = async () => {
    while (!stopped) {
      await runDueTicks(app);
      let worked = false;
      try { worked = await runOne(app); } catch (e) { app.log.error("worker error", { err: (e as Error).message }); }
      if (!worked) await new Promise((r) => setTimeout(r, 1000));
    }
  };
  loop();
  return () => { stopped = true; };
}

export async function jobStats(db: Queryable) {
  return (await db.query("SELECT kind, status, count(*)::int AS n, max(last_error) FILTER (WHERE status IN ('queued','dead')) AS last_error FROM jobs WHERE created_at > now() - interval '7 days' GROUP BY kind, status ORDER BY kind")).rows;
}
