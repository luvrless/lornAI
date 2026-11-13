import http from "node:http";
import type { App } from "./app.ts";
import { Router, createHandler, Ctx } from "./lib/http.ts";
import { resolveSessionToken } from "./modules/auth/service.ts";
import { SESSION_COOKIE, csrfFor } from "./modules/auth/cookies.ts";
import { resolveAdmin, syncPermissionRegistry } from "./modules/authz/service.ts";
import { getSetting } from "./modules/platform/service.ts";
import { configStatus } from "./lib/config.ts";
import { authRoutes } from "./modules/auth/routes.ts";
import { adminRoutes } from "./modules/authz/routes.ts";

export function buildRouter(app: App) {
  const r = new Router();

  r.get("/api/health", async () => {
    const t = Date.now();
    let db = "ok";
    try { await app.db.query("SELECT 1"); } catch { db = "down"; }
    return { status: db === "ok" ? "ok" : "degraded", db, dbLatencyMs: Date.now() - t, pool: app.db.stats, integrations: configStatus(app.cfg) };
  }, { maintenanceExempt: true });

  authRoutes(app, r);
  adminRoutes(app, r);
  return r;
}

export async function buildServer(app: App, extraFallback?: (c: Ctx) => Promise<boolean>) {
  await syncPermissionRegistry(app);
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
  }, extraFallback);
  return { server: http.createServer(handler), router };
}
