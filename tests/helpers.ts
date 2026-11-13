/**
 * Test harness: fresh schema on the test DB, a real HTTP server on a random
 * port, a cookie-jar client, and a local stand-in for Discord's OAuth token
 * and /users/@me endpoints (pointed at via DISCORD_API_BASE).
 */
import http from "node:http";
import { AddressInfo } from "node:net";
import { Connection, configFromUrl } from "../server/db/pg.ts";
import { migrate } from "../server/db/migrate.ts";
import { loadConfig } from "../server/lib/config.ts";
import { createApp, App } from "../server/app.ts";
import { buildServer } from "../server/server.ts";
import { clearSettingsCache } from "../server/modules/platform/service.ts";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://lorn:lorn_dev_pw@127.0.0.1:5432/lorn_test";
export const OWNER_ID = "409564774444171265";

export interface FakeDiscord { url: string; users: Map<string, { id: string; username: string }>; codes: Map<string, string>; close(): void; tokenRequests: number }

export async function startFakeDiscord(clientId: string, clientSecret: string): Promise<FakeDiscord> {
  const users = new Map<string, { id: string; username: string }>();
  const codes = new Map<string, string>(); // code -> discord id
  const tokens = new Map<string, string>(); // access token -> discord id
  const state = { tokenRequests: 0 };
  const srv = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks).toString();
    if (req.url === "/oauth2/token" && req.method === "POST") {
      state.tokenRequests++;
      const auth = Buffer.from(String(req.headers.authorization ?? "").replace("Basic ", ""), "base64").toString();
      const form = new URLSearchParams(body);
      const id = codes.get(form.get("code") ?? "");
      if (auth !== `${clientId}:${clientSecret}` || !id || form.get("grant_type") !== "authorization_code") {
        res.writeHead(400, { "content-type": "application/json" }); res.end('{"error":"invalid_grant"}'); return;
      }
      codes.delete(form.get("code")!); // single use, like Discord
      const at = "at_" + Math.random().toString(36).slice(2);
      tokens.set(at, id);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ access_token: at, refresh_token: "rt_x", expires_in: 604800, scope: "identify", token_type: "Bearer" }));
      return;
    }
    if (req.url === "/users/@me") {
      const id = tokens.get(String(req.headers.authorization ?? "").replace("Bearer ", ""));
      if (!id) { res.writeHead(401); res.end("{}"); return; }
      const u = users.get(id)!;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: u.id, username: u.username, avatar: null, global_name: u.username }));
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  return { url, users, codes, close: () => srv.close(), get tokenRequests() { return state.tokenRequests; } };
}

export async function resetDatabase() {
  const c = new Connection(configFromUrl(TEST_DB));
  await c.connect();
  await c.simple("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  c.close();
  await migrate(configFromUrl(TEST_DB), () => {});
  clearSettingsCache();
}

export interface Harness { app: App; base: string; discord: FakeDiscord; close(): Promise<void> }

export async function startHarness(): Promise<Harness> {
  await resetDatabase();
  const discord = await startFakeDiscord("test-client", "test-secret");
  Object.assign(process.env, {
    NODE_ENV: "test", DATABASE_URL: TEST_DB, APP_URL: "http://localhost:3999",
    LORN_OWNER_DISCORD_ID: OWNER_ID, TRUST_PROXY: "true", DISCORD_CLIENT_ID: "test-client", DISCORD_CLIENT_SECRET: "test-secret",
    DISCORD_API_BASE: discord.url, DISCORD_AUTHORIZE_URL: discord.url + "/authorize",
  });
  delete process.env.SMTP_URL;
  const app = createApp(loadConfig());
  const { server } = await buildServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    app, base, discord,
    async close() { server.close(); discord.close(); await app.db.end(); },
  };
}

/** Browser-like client: cookie jar, CSRF header, same-origin Origin. */
export class Client {
  jar = new Map<string, string>();
  csrf = "";
  ip: string;
  constructor(public base: string, ip?: string, public ua = "Mozilla/5.0 (Windows NT 10.0) Chrome/130") {
    this.ip = ip ?? `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.1`;
  }

  private store(res: Response) {
    for (const sc of res.headers.getSetCookie()) {
      const [kv, ...attrs] = sc.split(";");
      const i = kv.indexOf("=");
      const name = kv.slice(0, i), value = decodeURIComponent(kv.slice(i + 1));
      if (attrs.some((a) => a.trim().toLowerCase() === "max-age=0")) this.jar.delete(name); else this.jar.set(name, value);
    }
  }

  async req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      cookie: [...this.jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; "),
      origin: "http://localhost:3999", "user-agent": this.ua, "x-forwarded-for": this.ip, ...extra,
    };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (method !== "GET" && this.csrf && !("x-csrf-token" in extra)) headers["x-csrf-token"] = this.csrf;
    const res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    this.store(res);
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (json && typeof json === "object" && typeof json.csrf === "string") this.csrf = json.csrf;
    return { status: res.status, body: json, headers: res.headers };
  }
  get(p: string, extra?: Record<string, string>) { return this.req("GET", p, undefined, extra); }
  post(p: string, b: unknown = {}, extra?: Record<string, string>) { return this.req("POST", p, b, extra); }
  patch(p: string, b: unknown = {}) { return this.req("PATCH", p, b); }
  put(p: string, b: unknown = {}) { return this.req("PUT", p, b); }
  del(p: string, b: unknown = {}) { return this.req("DELETE", p, b); }

  async refreshCsrf() { await this.get("/api/auth/me"); }

  /** Full Discord OAuth round trip against the fake provider. */
  async discord(h: Harness, discordId: string, username: string, intent: "login" | "link" | "admin" = "login") {
    h.discord.users.set(discordId, { id: discordId, username });
    const start = await this.get(`/api/auth/discord/start?intent=${intent}`);
    if (start.status !== 302) return { status: start.status, location: null as string | null, body: start.body };
    const loc = new URL(start.headers.get("location")!);
    const state = loc.searchParams.get("state")!;
    const code = "code_" + Math.random().toString(36).slice(2);
    h.discord.codes.set(code, discordId);
    const cb = await this.get(`/api/auth/discord/callback?code=${code}&state=${encodeURIComponent(state)}`);
    return { status: cb.status, location: cb.headers.get("location"), body: cb.body, authorizeUrl: loc };
  }
}

export async function lastEmailToken(app: App, to: string, template: string) {
  const r = (await app.db.query("SELECT text_body FROM email_outbox WHERE to_address = $1 AND template = $2 ORDER BY id DESC LIMIT 1", [to, template])).rows[0];
  return r ? /token=([A-Za-z0-9_-]+)/.exec(r.text_body)?.[1] ?? null : null;
}

/** Register a password user and return a signed-in client. */
export async function newUser(h: Harness, username: string, password = "Sunset-Driver-77") {
  const c = new Client(h.base);
  const r = await c.post("/api/auth/register", { username, email: `${username.toLowerCase()}@example.com`, password, acceptTos: true });
  if (r.status !== 200) throw new Error(`register ${username} failed: ${JSON.stringify(r.body)}`);
  return Object.assign(c, { userId: (await h.app.db.query("SELECT id FROM users WHERE username = $1", [username])).rows[0].id as string, uid: r.body.user.uid as number });
}

/** Owner signed up through Discord and elevated to an admin session. */
export async function ownerClient(h: Harness) {
  const c = new Client(h.base);
  await c.discord(h, OWNER_ID, "q5", "admin");
  if ((await c.get("/api/auth/me")).body.user === null) await c.post("/api/auth/signup/complete", { username: "q5", acceptTos: true });
  await c.discord(h, OWNER_ID, "q5", "admin");
  await c.refreshCsrf();
  return c;
}

/** Staff/admin by Discord ID (owner must have authorized them). */
export async function staffClient(h: Harness, owner: Client, discordId: string, username: string, role: "ADMIN" | "STAFF") {
  await owner.post("/api/admin/staff", { discordId, role });
  const c = new Client(h.base);
  await c.discord(h, discordId, username, "admin");
  await c.post("/api/auth/signup/complete", { username, acceptTos: true });
  await c.discord(h, discordId, username, "admin");
  await c.refreshCsrf();
  return c;
}

/** Full upload flow: start → PUT bytes → complete. */
export async function upload(c: Client, buf: Buffer, filename: string, mime: string, extra: Record<string, unknown> = {}, paths = { start: "/api/media/uploads", complete: (id: string) => `/api/media/uploads/${id}/complete` }) {
  const s = await c.post(paths.start, { filename, mime, size: buf.length, ...extra });
  if (s.status !== 200) return s;
  const put = await fetch(c.base + s.body.target.url, { method: "PUT", body: new Uint8Array(buf), headers: s.body.target.headers });
  if (put.status !== 200) return { status: put.status, body: await put.json() };
  return c.post(paths.complete(s.body.uploadId), {});
}
