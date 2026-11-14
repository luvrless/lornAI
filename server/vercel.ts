/**
 * Vercel entry: the whole API + server-rendered pages as one Node function.
 *
 * - Boots once per instance (migrations are advisory-locked and no-ops once applied).
 * - Background work runs after the response via Vercel's waitUntil: queued jobs
 *   (emails, badge distribution) drain after any write, and maintenance ticks
 *   (claimed in the database so they run once per interval across instances)
 *   are checked at most once a minute per instance.
 * - /api/cron is called by Vercel Cron as a safety net when traffic is quiet.
 */
import type http from "node:http";
import crypto from "node:crypto";
import { loadConfig } from "./lib/config.ts";
import { createApp, type App } from "./app.ts";
import { migrate } from "./db/migrate.ts";
import { configFromUrl } from "./db/pg.ts";
import { buildServer } from "./server.ts";
import { drain, runDueTicks } from "./modules/jobs/runner.ts";

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
let booting: Promise<{ app: App; handler: Handler }> | null = null;

function boot() {
  booting ??= (async () => {
    const cfg = loadConfig();
    const app = createApp(cfg);
    await migrate(configFromUrl(cfg.databaseUrl), (m) => app.log.info(m));
    const { handler } = await buildServer(app);
    return { app, handler };
  })().catch((e) => { booting = null; throw e; });
  return booting;
}

/** Vercel's request context exposes waitUntil (what @vercel/functions wraps). */
function waitUntil(p: Promise<unknown>) {
  const ctx = (globalThis as any)[Symbol.for("@vercel/request-context")]?.get?.();
  if (ctx?.waitUntil) ctx.waitUntil(p); else void p;
}

let lastTicks = 0, draining = false;
async function background(app: App, wrote: boolean) {
  if (draining) return;
  draining = true;
  try {
    if (Date.now() - lastTicks > 60_000) { lastTicks = Date.now(); await runDueTicks(app); }
    if (wrote) await drain(app, 25);
  } catch (e) {
    app.log.error("background work failed", { err: (e as Error).message });
  } finally { draining = false; }
}

const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export default async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  let booted;
  try { booted = await boot(); } catch (e) {
    console.error("boot failed", e);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { code: "starting", message: "LORN.LOL is starting up. Try again in a moment." } }));
    return;
  }
  const { app, handler } = booted;

  if (req.url?.split("?")[0] === "/api/cron") {
    const secret = process.env.CRON_SECRET ?? "";
    if (!secret || !safeEqual(String(req.headers.authorization ?? ""), `Bearer ${secret}`)) { res.statusCode = 401; res.end(); return; }
    lastTicks = 0;
    await background(app, true);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  await handler(req, res);
  waitUntil(background(app, req.method !== "GET" && req.method !== "HEAD"));
}
