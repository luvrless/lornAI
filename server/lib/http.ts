/**
 * Small HTTP framework: routing, JSON bodies, cookies, security headers,
 * origin + CSRF checks, rate limits, and declarative auth/permission guards.
 * Admin routes cannot be registered without a permission (fail closed).
 */
import http from "node:http";
import crypto from "node:crypto";
import { z, ZodTypeAny } from "zod";
import { HttpError, badRequest, forbidden, tooMany, unauthorized, notFound } from "./errors.ts";
import type { RateLimitRule, RateLimitStore } from "./ratelimit.ts";
import type { Permission } from "../modules/authz/registry.ts";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface SessionInfo {
  id: string;
  userId: string;
  authMethod: string;
  mfaPending: boolean;
  mfaMethod?: string | null;
  csrf: string;
}

export interface AuthUser {
  id: string;
  uid: number;
  username: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

export interface AdminPrincipal {
  userId: string;
  uid: number;
  discordId: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  staffId: string | null;
  permissions: Set<Permission>;
  adminSessionId: string;
}

export interface CookieOpts {
  maxAge?: number;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
}

export class Ctx {
  params: Record<string, string> = {};
  session: SessionInfo | null = null;
  user: AuthUser | null = null;
  admin: AdminPrincipal | null = null;
  readonly requestId = crypto.randomUUID();
  readonly url: URL;
  readonly cookies: Record<string, string>;
  private bodyCache: unknown = undefined;
  private outCookies: string[] = [];
  sent = false;

  constructor(public req: http.IncomingMessage, public res: http.ServerResponse, public ip: string, private secure: boolean) {
    this.url = new URL(req.url ?? "/", "http://local");
    this.cookies = parseCookies(req.headers.cookie ?? "");
  }

  get method() { return (this.req.method ?? "GET").toUpperCase() as Method; }
  get ua() { return String(this.req.headers["user-agent"] ?? "").slice(0, 512); }
  get query() { return Object.fromEntries(this.url.searchParams); }

  async body<S extends ZodTypeAny>(schema: S): Promise<z.output<S>> {
    if (this.bodyCache === undefined) this.bodyCache = await readJson(this.req);
    return validate(schema, this.bodyCache);
  }

  setCookie(name: string, value: string, o: CookieOpts = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? "/"}`, `SameSite=${o.sameSite ?? "Lax"}`];
    if (o.httpOnly !== false) parts.push("HttpOnly");
    if (this.secure) parts.push("Secure");
    if (o.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(o.maxAge)}`);
    this.outCookies.push(parts.join("; "));
  }

  clearCookie(name: string, o: CookieOpts = {}) {
    this.setCookie(name, "", { ...o, maxAge: 0 });
  }

  /** Throws 403 unless the admin principal has every listed permission. */
  require(...perms: Permission[]) {
    if (!this.admin) throw forbidden();
    for (const p of perms) if (!this.admin.permissions.has(p)) throw forbidden(`Missing permission: ${p}`);
  }

  can(p: Permission) { return !!this.admin?.permissions.has(p); }

  send(status: number, body: string | Buffer, type = "application/json; charset=utf-8", headers: Record<string, string> = {}) {
    if (this.sent) return;
    this.sent = true;
    if (this.outCookies.length) this.res.setHeader("Set-Cookie", this.outCookies);
    // Every dynamic response is per-visitor: tell browsers and any CDN in front never to store or share it.
    this.res.writeHead(status, { "Content-Type": type, "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", Vary: "Cookie", ...headers });
    this.res.end(body);
  }

  json(status: number, data: unknown) {
    this.send(status, JSON.stringify(data));
  }

  redirect(location: string, status = 302) {
    if (this.sent) return;
    this.sent = true;
    if (this.outCookies.length) this.res.setHeader("Set-Cookie", this.outCookies);
    this.res.writeHead(status, { Location: location, "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store" });
    this.res.end();
  }
}

export function validate<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpError(422, "validation_failed", "Some fields are invalid",
      r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return r.data;
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore malformed */ }
  }
  return out;
}

const MAX_BODY = 1_000_000;

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const ct = String(req.headers["content-type"] ?? "");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, "payload_too_large", "Request body too large");
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  if (!ct.startsWith("application/json")) throw new HttpError(415, "unsupported_media_type", "Expected application/json");
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw badRequest("Malformed JSON"); }
}

// ------------------------------------------------------------------ router

export interface RouteOpts {
  /** 'required' (default for /api/me…), 'optional', 'none' */
  auth?: "required" | "optional" | "none";
  /** Admin permission(s). Implies admin elevation and auth. */
  perm?: Permission | Permission[];
  rate?: { name: string; rule: RateLimitRule; by?: "ip" | "user" };
  /** Allow sessions waiting for a 2FA code (only the 2FA endpoints). */
  allowMfaPending?: boolean;
  /** Skip origin/CSRF checks (OAuth callbacks are GETs, webhooks use signatures). */
  skipCsrf?: boolean;
  /** Allowed while maintenance mode is on. */
  maintenanceExempt?: boolean;
}

type Handler = (c: Ctx) => unknown | Promise<unknown>;

interface Route {
  method: Method;
  parts: string[];
  handler: Handler;
  opts: RouteOpts;
}

export interface Hooks {
  resolveSession(c: Ctx): Promise<void>;
  resolveAdmin(c: Ctx): Promise<void>;
  isMaintenance(): Promise<boolean>;
  csrfFor(sessionId: string): string;
  limiter: RateLimitStore;
  appOrigin: string;
  trustProxy: boolean;
  secureCookies: boolean;
  onError(c: Ctx, e: unknown): void;
}

export class Router {
  private routes: Route[] = [];

  add(method: Method, path: string, handler: Handler, opts: RouteOpts = {}) {
    if (path.startsWith("/api/admin") && !opts.perm) {
      throw new Error(`Admin route ${method} ${path} registered without a permission`);
    }
    this.routes.push({ method, parts: path.split("/").filter(Boolean), handler, opts });
  }
  get(p: string, h: Handler, o?: RouteOpts) { this.add("GET", p, h, o); }
  post(p: string, h: Handler, o?: RouteOpts) { this.add("POST", p, h, o); }
  put(p: string, h: Handler, o?: RouteOpts) { this.add("PUT", p, h, o); }
  patch(p: string, h: Handler, o?: RouteOpts) { this.add("PATCH", p, h, o); }
  delete(p: string, h: Handler, o?: RouteOpts) { this.add("DELETE", p, h, o); }

  match(method: Method, pathname: string): { route: Route; params: Record<string, string> } | "method" | null {
    const parts = pathname.split("/").filter(Boolean);
    let methodMismatch = false;
    for (const r of this.routes) {
      if (r.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const rp = r.parts[i];
        if (rp.startsWith(":")) {
          try { params[rp.slice(1)] = decodeURIComponent(parts[i]); } catch { ok = false; break; }
        } else if (rp !== parts[i]) { ok = false; break; }
      }
      if (!ok) continue;
      if (r.method !== method) { methodMismatch = true; continue; }
      return { route: r, params };
    }
    return methodMismatch ? "method" : null;
  }

  list() {
    return this.routes.map((r) => ({ method: r.method, path: "/" + r.parts.join("/"), perm: r.opts.perm, auth: r.opts.auth }));
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function createHandler(router: Router, hooks: Hooks, fallback?: (c: Ctx) => Promise<boolean>) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const fwd = hooks.trustProxy ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() : "";
    const ip = (fwd || req.socket.remoteAddress || "0.0.0.0").replace(/^::ffff:/, "");
    const c = new Ctx(req, res, ip, hooks.secureCookies);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    if (hooks.secureCookies) res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    res.setHeader("X-Request-Id", c.requestId);

    try {
      const pathname = c.url.pathname;
      const m = router.match(c.method, pathname);
      if (m === null) {
        if (fallback && (await fallback(c))) return;
        throw notFound();
      }
      if (m === "method") throw new HttpError(405, "method_not_allowed", "Method not allowed");
      const { route, params } = m;
      c.params = params;
      const o = route.opts;
      const unsafe = c.method !== "GET";

      // Cross-origin writes are refused outright.
      if (unsafe && !o.skipCsrf) {
        const origin = req.headers.origin;
        if (origin && origin !== hooks.appOrigin) throw forbidden("Cross-origin request refused");
      }

      const g = hooks.limiter.take(`g:${ip}`, { capacity: 300, refillPerSec: 5 });
      if (!g.ok) throw tooMany(g.retryAfter);

      await hooks.resolveSession(c);

      if (!o.maintenanceExempt && !pathname.startsWith("/api/admin") && (await hooks.isMaintenance())) {
        throw new HttpError(503, "maintenance", "LORN.LOL is in maintenance mode");
      }

      if (o.rate) {
        const key = o.rate.by === "user" && c.user ? `r:${o.rate.name}:u:${c.user.id}` : `r:${o.rate.name}:ip:${ip}`;
        const r = hooks.limiter.take(key, o.rate.rule);
        if (!r.ok) throw tooMany(r.retryAfter);
      }

      // CSRF: every authenticated write must carry the session-bound token.
      if (unsafe && !o.skipCsrf && c.session) {
        const sent = String(req.headers["x-csrf-token"] ?? "");
        const want = hooks.csrfFor(c.session.id);
        if (!sent || sent.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(want))) {
          throw forbidden("Invalid CSRF token");
        }
      }

      const needAuth = o.perm ? "required" : (o.auth ?? "none");
      if (needAuth === "required") {
        if (!c.session || !c.user) throw unauthorized();
        if (c.session.mfaPending && !o.allowMfaPending) throw new HttpError(401, "mfa_required", "Enter the code we emailed you to finish signing in");
      }

      if (o.perm) {
        await hooks.resolveAdmin(c);
        if (!c.admin) throw new HttpError(403, "admin_required", "Administrative access required");
        const perms = Array.isArray(o.perm) ? o.perm : [o.perm];
        c.require(...perms);
        const r = hooks.limiter.take(`admin:${c.admin.userId}`, { capacity: 120, refillPerSec: 2 });
        if (!r.ok) throw tooMany(r.retryAfter);
      }

      const out = await route.handler(c);
      if (!c.sent) {
        if (out === undefined) c.send(204, "");
        else c.json(200, out);
      }
    } catch (e) {
      if (c.sent) return;
      if (e instanceof HttpError) {
        if (e.status === 429) res.setHeader("Retry-After", String((e.details as any)?.retryAfter ?? 60));
        c.json(e.status, { error: { code: e.code, message: e.message, details: e.details } });
      } else {
        hooks.onError(c, e);
        c.json(500, { error: { code: "internal", message: "Something went wrong on our side", requestId: c.requestId } });
      }
    }
  };
}

export { z };
