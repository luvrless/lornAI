import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { App } from "./app.ts";
import { Router, createHandler, Ctx } from "./lib/http.ts";
import { resolveSessionToken } from "./modules/auth/service.ts";
import { SESSION_COOKIE, csrfFor } from "./modules/auth/cookies.ts";
import { resolveAdmin, syncPermissionRegistry } from "./modules/authz/service.ts";
import { getSetting } from "./modules/platform/service.ts";
import { configStatus } from "./lib/config.ts";
import { authRoutes } from "./modules/auth/routes.ts";
import { adminRoutes } from "./modules/authz/routes.ts";
import { profileRoutes } from "./modules/profiles/routes.ts";
import { mediaRoutes } from "./modules/media/routes.ts";
import { featureRoutes } from "./modules/features/routes.ts";
import { adminPanelRoutes } from "./modules/admin/routes.ts";
import { seedBadges } from "./modules/badges/service.ts";
import { seedEventsAndMilestones } from "./modules/events/service.ts";
import { MIME_BY_EXT } from "./modules/media/service.ts";
import { LocalStorage } from "./modules/media/storage.ts";
import { renderPage } from "./web.ts";
import "./modules/jobs/schedules.ts";

export function buildRouter(app: App) {
  const r = new Router();
  r.get("/api/health", async () => {
    const t = Date.now();
    let db = "ok";
    try { await app.db.query("SELECT 1"); } catch { db = "down"; }
    return { app: "lorn", status: db === "ok" ? "ok" : "degraded", db, dbLatencyMs: Date.now() - t, pool: app.db.stats, storage: app.storageStatus, integrations: configStatus(app.cfg) };
  }, { maintenanceExempt: true });
  // Real platform totals for the landing page, straight from the database (cached briefly).
  let totals: { at: number; v: { members: number; views: number; live: number } } | null = null;
  r.get("/api/public/stats", async () => {
    if (!totals || Date.now() - totals.at > 60_000) {
      const row = (await app.db.query(
        `SELECT (SELECT count(*) FROM users WHERE deleted_at IS NULL) AS members,
                (SELECT coalesce(sum(view_count), 0) FROM profiles) AS views,
                (SELECT count(*) FROM profiles WHERE is_published) AS live`)).rows[0];
      totals = { at: Date.now(), v: { members: Number(row.members), views: Number(row.views), live: Number(row.live) } };
    }
    return totals.v;
  }, { maintenanceExempt: true });
  authRoutes(app, r);
  adminRoutes(app, r);
  profileRoutes(app, r);
  mediaRoutes(app, r);
  featureRoutes(app, r);
  adminPanelRoutes(app, r);
  return r;
}

/** Serve local-driver media with byte ranges (needed for video/audio seeking). */
async function serveMedia(app: App, c: Ctx): Promise<boolean> {
  if (app.storage.name !== "local" || !c.url.pathname.startsWith("/media/") || c.method !== "GET") return false;
  const key = decodeURIComponent(c.url.pathname.slice("/media/".length));
  let file: string;
  try { file = (app.storage as LocalStorage).file(key); } catch { return false; }
  let st: fs.Stats;
  try { st = await fs.promises.stat(file); } catch { return false; }
  if (!st.isFile()) return false;
  const ext = key.split(".").pop()!.toLowerCase();
  const type = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const headers: Record<string, string | number> = {
    "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Security-Policy": "default-src 'none'; sandbox", "Cross-Origin-Resource-Policy": "cross-origin", "X-Content-Type-Options": "nosniff",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(c.req.headers.range ?? ""));
  c.sent = true;
  if (range) {
    let start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : st.size - 1;
    if (!range[1]) end = st.size - 1;
    if (start < 0) start = 0;
    if (start >= st.size || end < start) {
      c.res.writeHead(416, { "Content-Range": `bytes */${st.size}` });
      c.res.end();
      return true;
    }
    end = Math.min(end, st.size - 1);
    c.res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(c.res);
  } else {
    c.res.writeHead(200, { ...headers, "Content-Length": st.size });
    fs.createReadStream(file).pipe(c.res);
  }
  return true;
}

const STATIC_DIR = path.resolve(process.env.WEB_DIST ?? (process.env.VERCEL ? "public/static" : "dist/web"));
const STATIC_TYPES: Record<string, string> = { js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", svg: "image/svg+xml", png: "image/png", woff2: "font/woff2", ico: "image/x-icon", map: "application/json", txt: "text/plain" };

async function serveStatic(c: Ctx): Promise<boolean> {
  if (c.method !== "GET") return false;
  const pathname = c.url.pathname === "/favicon.ico" ? "/static/brand/favicon.ico" : c.url.pathname;
  if (!pathname.startsWith("/static/")) return false;
  const rel = path.normalize(decodeURIComponent(pathname.slice(8)));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  const file = path.join(STATIC_DIR, rel);
  try {
    const body = await fs.promises.readFile(file);
    c.send(200, body, STATIC_TYPES[file.split(".").pop()!] ?? "application/octet-stream", { "Cache-Control": /\.[a-f0-9]{8,}\./.test(file) ? "public, max-age=31536000, immutable" : "public, max-age=300" });
    return true;
  } catch { return false; }
}

export async function buildServer(app: App) {
  await syncPermissionRegistry(app);
  await seedBadges(app.db);
  await seedEventsAndMilestones(app.db);
  const router = buildRouter(app);
  const handler = createHandler(router, {
    async resolveSession(c) {
      const token = c.cookies[SESSION_COOKIE];
      if (!token || token.length > 100) return;
      const s = await resolveSessionToken(app, token);
      if (!s) return;
      c.session = { id: s.sessionId, userId: s.user.id, authMethod: s.authMethod, mfaPending: s.mfaPending, csrf: csrfFor(app, s.sessionId) };
      c.user = s.user;
    },
    resolveAdmin: (c) => resolveAdmin(app, c),
    async isMaintenance() { return getSetting<boolean>(app, "maintenance.enabled", false); },
    csrfFor: (id) => csrfFor(app, id),
    limiter: app.limiter,
    appOrigin: app.cfg.appOrigin,
    trustProxy: app.cfg.trustProxy,
    secureCookies: app.cfg.secureCookies,
    onError(c, e) { app.log.error("unhandled", { requestId: c.requestId, path: c.url.pathname, err: (e as Error).stack }); },
  }, async (c) => (await serveMedia(app, c)) || (await serveStatic(c)) || (await renderPage(app, c)));
  return { server: http.createServer(handler), router, handler };
}
