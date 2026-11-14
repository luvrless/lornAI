/**
 * Google sign-in brokered by Supabase Auth (PKCE), with the NextAuth-style
 * callback path used in production (/api/auth/callback/{provider}).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { startHarness, Harness, Client } from "./helpers.ts";
import { closeHashPool } from "../server/lib/password.ts";

let h: Harness, sb: http.Server, sbUrl = "";
const flows = new Map<string, { challenge: string; redirect: string }>();
const calls: string[] = [];
let googleUser = { sub: "109876543210987654321", email: "jay.google@example.com", email_verified: true, full_name: "Jay G", avatar_url: "https://lh3.googleusercontent.com/a/x" };

before(async () => {
  sb = http.createServer(async (req, res) => {
    const u = new URL(req.url!, sbUrl);
    calls.push(`${req.method} ${u.pathname}`);
    if (u.pathname === "/auth/v1/authorize") {
      assert.equal(u.searchParams.get("provider"), "google");
      assert.equal(u.searchParams.get("code_challenge_method"), "s256");
      const code = crypto.randomUUID();
      flows.set(code, { challenge: u.searchParams.get("code_challenge")!, redirect: u.searchParams.get("redirect_to")! });
      const back = new URL(u.searchParams.get("redirect_to")!);
      back.searchParams.set("code", code); // what GoTrue does after Google approves
      res.writeHead(302, { location: back.toString() }); res.end(); return;
    }
    if (u.pathname === "/auth/v1/token" && u.searchParams.get("grant_type") === "pkce") {
      assert.ok(req.headers.apikey, "publishable key sent");
      let raw = ""; for await (const ch of req) raw += ch;
      const { auth_code, code_verifier } = JSON.parse(raw);
      const f = flows.get(auth_code);
      flows.delete(auth_code);
      const ok = f && crypto.createHash("sha256").update(code_verifier).digest("base64url") === f.challenge;
      if (!ok) { res.writeHead(400, { "content-type": "application/json" }); res.end('{"error":"invalid_grant"}'); return; }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ access_token: "sb-access", refresh_token: "sb-refresh", user: { id: crypto.randomUUID(), email: googleUser.email, identities: [{ provider: "google", identity_data: { ...googleUser, provider_id: googleUser.sub } }] } }));
      return;
    }
    if (u.pathname === "/auth/v1/logout") { assert.equal(req.headers.authorization, "Bearer sb-access"); res.writeHead(204); res.end(); return; }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => sb.listen(0, "127.0.0.1", r));
  sbUrl = `http://127.0.0.1:${(sb.address() as any).port}`;
  Object.assign(process.env, { SUPABASE_URL: sbUrl, SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", OAUTH_CALLBACK_PATH: "/api/auth/callback/{provider}" });
  h = await startHarness();
});
after(async () => {
  for (const k of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "OAUTH_CALLBACK_PATH"]) delete process.env[k];
  sb.close(); await h.close(); await closeHashPool();
});

/** Drive the redirect chain like a browser: start → Supabase → our callback. */
async function googleSignIn(c: Client, intent = "login") {
  const start = await c.get(`/api/auth/google/start?intent=${intent}`);
  assert.equal(start.status, 302);
  const cookie = start.headers.get("set-cookie") ?? "";
  assert.match(cookie, /lorn_oauth=[^;]+;.*Path=\/api\/auth(;|$)/i, "state cookie reaches /api/auth/callback/*");
  const toSb = new URL(start.headers.get("location")!);
  assert.equal(toSb.origin + toSb.pathname, `${sbUrl}/auth/v1/authorize`);
  const r = await fetch(toSb, { redirect: "manual" });
  const back = new URL(r.headers.get("location")!);
  assert.equal(back.pathname, "/api/auth/callback/google");
  return c.get(back.pathname + back.search);
}

test("providers list Google when Supabase Auth is configured", async () => {
  const c = new Client(h.base);
  const p = await c.get("/api/auth/providers");
  assert.equal(p.body.google, true);
});

test("sign up and sign in with Google through Supabase; LORN owns the session", async () => {
  const c = new Client(h.base);
  const cb = await googleSignIn(c);
  assert.equal(cb.status, 302);
  assert.match(cb.headers.get("location")!, /\/signup\/complete/);
  const pending = await c.get("/api/auth/signup/pending");
  assert.equal(pending.body.provider, "google");
  await c.refreshCsrf();
  const done = await c.post("/api/auth/signup/complete", { username: "jayg", acceptTos: true });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  const acct = (await h.app.db.query("SELECT provider_user_id FROM oauth_accounts WHERE provider = 'google'")).rows[0];
  assert.equal(acct.provider_user_id, googleUser.sub, "linked by the stable Google ID");
  const u = (await h.app.db.query("SELECT email, email_verified_at FROM users WHERE username = 'jayg'")).rows[0];
  assert.equal(u.email, googleUser.email);
  assert.ok(u.email_verified_at, "Google-verified email adopted");
  assert.ok(calls.includes("POST /auth/v1/logout"), "Supabase session ended right after the exchange");

  // Second time: straight in.
  const c2 = new Client(h.base);
  const again = await googleSignIn(c2);
  assert.equal(again.headers.get("location"), "/dashboard");
  assert.equal((await c2.get("/api/auth/me")).body.user.username, "jayg");
});

test("a replayed or tampered code is rejected", async () => {
  const c = new Client(h.base);
  const start = await c.get("/api/auth/google/start?intent=login");
  const r = await fetch(new URL(start.headers.get("location")!), { redirect: "manual" });
  const back = new URL(r.headers.get("location")!);
  back.searchParams.set("code", "not-a-real-code");
  const cb = await c.get(back.pathname + back.search);
  assert.match(cb.headers.get("location")!, /error=oauth_exchange_failed/);
});

test("Discord also uses the NextAuth-style callback and the state cookie reaches it", async () => {
  const c = new Client(h.base);
  const start = await c.get("/api/auth/discord/start?intent=login");
  assert.equal(new URL(start.headers.get("location")!).searchParams.get("redirect_uri"), `${h.base}/api/auth/callback/discord`.replace(h.base, new URL(h.app.cfg.appUrl).origin));
  assert.match(start.headers.get("set-cookie") ?? "", /Path=\/api\/auth(;|$)/i);
});

test("emails go out as multipart: branded HTML plus plain text", async () => {
  const { sendMail } = await import("../server/lib/smtp.ts");
  const { emails } = await import("../server/lib/email-templates.ts");
  const net = await import("node:net");
  let data = "";
  const srv = net.createServer((s) => {
    s.write("220 fake ESMTP\r\n");
    let inData = false, buf = "";
    s.on("data", (d) => {
      buf += d.toString();
      if (inData) { if (buf.includes("\r\n.\r\n")) { data = buf; inData = false; buf = ""; s.write("250 queued\r\n"); } return; }
      for (const line of buf.split("\r\n").slice(0, -1)) {
        if (/^EHLO/i.test(line)) s.write("250-fake\r\n250 OK\r\n");
        else if (/^DATA/i.test(line)) { inData = true; s.write("354 go\r\n"); }
        else if (/^QUIT/i.test(line)) { s.end("221 bye\r\n"); }
        else s.write("250 OK\r\n");
      }
      buf = inData ? "" : buf.slice(buf.lastIndexOf("\r\n") + 2);
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const port = (srv.address() as any).port;
  const m = emails.verifyEmail("https://lorn.lol", { username: "jay", url: "https://lorn.lol/verify-email?token=t" });
  await sendMail(`smtp://127.0.0.1:${port}?insecure=1`, { from: "LORN.LOL <no-reply@lorn.lol>", to: "jay@example.com", subject: m.subject, text: m.text, html: m.html });
  srv.close();
  assert.match(data, /Content-Type: multipart\/alternative; boundary="lorn-/);
  const parts = [...data.matchAll(/Content-Type: (text\/\w+); charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]+?)\r\n--/g)];
  assert.deepEqual(parts.map((p) => p[1]), ["text/plain", "text/html"]);
  const html = Buffer.from(parts[1][2].replace(/\r\n/g, ""), "base64").toString();
  assert.match(html, /Confirm email<\/a>/);
  assert.match(Buffer.from(parts[0][2].replace(/\r\n/g, ""), "base64").toString(), /Confirm email: https:\/\/lorn\.lol\/verify-email\?token=t/);
});

test("queued emails carry the HTML version", async () => {
  const c = new Client(h.base);
  await c.post("/api/auth/forgot-password", { identifier: "jayg" });
  const row = (await h.app.db.query("SELECT template, html_body, text_body FROM email_outbox WHERE template = 'reset_password' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.ok(row, "reset email queued");
  assert.match(row.html_body, /Choose a new password/);
  assert.match(row.text_body, /reset-password\?token=/);
});
