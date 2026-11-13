/** Acceptance tests 1–8 (user system) plus security behaviour of auth. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startHarness, Harness, Client, lastEmailToken } from "./helpers.ts";
import { totp, base32Decode } from "../server/lib/crypto.ts";
import { closeHashPool } from "../server/lib/password.ts";

let h: Harness;
before(async () => { h = await startHarness(); });
after(async () => { await h.close(); await closeHashPool(); });

const PW = "Sunset-Driver-77";

test("1/3/4: register claims a username and gets UID 1; session cookie is HttpOnly", async () => {
  const c = new Client(h.base);
  const r = await c.post("/api/auth/register", { username: "Jay", email: "jay@example.com", password: PW, acceptTos: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.uid, 1);
  assert.equal(r.body.user.username, "Jay");
  assert.equal(r.body.verificationEmail, "not_configured"); // honest: no SMTP in test env
  const me = await c.get("/api/auth/me");
  assert.equal(me.body.user.uid, 1);
  const raw = (await fetch(h.base + "/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3999", "x-forwarded-for": "10.9.9.9" },
    body: JSON.stringify({ username: "cookiechk", email: "ck@example.com", password: PW, acceptTos: true }),
  })).headers.getSetCookie()[0];
  assert.match(raw, /lorn_session=.+; Path=\/; SameSite=Lax; HttpOnly/);
});

test("3: username rules — case-insensitive uniqueness, reserved, charset, length", async () => {
  const c = new Client(h.base);
  const reg = (username: string, email: string) => new Client(h.base).post("/api/auth/register", { username, email, password: PW, acceptTos: true });
  assert.equal((await reg("JAY", "a1@example.com")).body.error.code, "username_unavailable");
  assert.equal((await reg("admin", "a2@example.com")).body.error.message, "This username is reserved");
  assert.equal((await reg("bad name!", "a3@example.com")).body.error.code, "username_unavailable");
  assert.equal((await reg("thirteenchars", "a4@example.com")).status, 422);
  assert.equal((await reg("x", "a5@example.com")).status, 200); // 1 char allowed
  const chk = await c.get("/api/auth/username/jAy");
  assert.equal(chk.body.available, false);
  assert.equal((await reg("ok", "jay@EXAMPLE.com")).body.error.code, "email_taken"); // email is case-insensitive
  assert.equal((await reg("notos", "n@example.com").then(() => new Client(h.base).post("/api/auth/register", { username: "notos2", email: "n2@example.com", password: PW, acceptTos: false }))).status, 422);
  // Per-IP sign-up limit: 5 per hour.
  const same = new Client(h.base, "10.250.250.250");
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await same.post("/api/auth/register", { username: `rl${i}`, email: `rl${i}@example.com`, password: PW, acceptTos: true })).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429]);
});

test("4: UIDs are sequential, gapless under concurrency, and failures do not consume one", async () => {
  const before = (await h.app.db.query("SELECT last FROM uid_counter")).rows[0].last;
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    new Client(h.base).post("/api/auth/register", { username: `conc${i}`, email: `conc${i}@example.com`, password: PW, acceptTos: true })));
  const uids = results.map((r) => r.body.user.uid).sort((a, b) => a - b);
  assert.deepEqual(uids, Array.from({ length: 8 }, (_, i) => before + 1 + i));
  // A failed signup (taken name) must not burn a UID.
  await new Client(h.base).post("/api/auth/register", { username: "conc0", email: "dup@example.com", password: PW, acceptTos: true });
  const next = await new Client(h.base).post("/api/auth/register", { username: "afterfail", email: "af@example.com", password: PW, acceptTos: true });
  assert.equal(next.body.user.uid, before + 9);
});

test("2/7: login by username or email; sessions persist across clients; logout revokes", async () => {
  const a = new Client(h.base);
  const r1 = await a.post("/api/auth/login", { identifier: "jay", password: PW });
  assert.equal(r1.status, 200);
  const b = new Client(h.base);
  assert.equal((await b.post("/api/auth/login", { identifier: "JAY@example.com", password: PW })).status, 200);
  // Persisted: a brand-new client carrying the same cookie is still signed in.
  const c = new Client(h.base);
  c.jar = new Map(a.jar);
  assert.equal((await c.get("/api/auth/me")).body.user.username, "Jay");
  const sessions = await a.get("/api/account/sessions");
  assert.ok(sessions.body.length >= 3);
  await a.post("/api/auth/logout");
  assert.equal((await c.get("/api/auth/me")).body.user, null);
  assert.equal((await b.get("/api/auth/me")).body.user.username, "Jay");
});

test("wrong password is rejected identically for unknown users; lockout after repeated failures", async () => {
  const c = new Client(h.base, "10.200.0.1");
  const bad = await c.post("/api/auth/login", { identifier: "conc3", password: "nope-nope" });
  const unknown = await c.post("/api/auth/login", { identifier: "ghost", password: "nope-nope" });
  assert.equal(bad.status, 401);
  assert.deepEqual(bad.body, unknown.body);
  await h.app.db.query("UPDATE platform_settings SET value = '3' WHERE key = 'security.max_failed_logins'");
  const { clearSettingsCache } = await import("../server/modules/platform/service.ts");
  clearSettingsCache();
  for (let i = 0; i < 2; i++) await new Client(h.base).post("/api/auth/login", { identifier: "conc3", password: "nope-nope" });
  const locked = await new Client(h.base).post("/api/auth/login", { identifier: "conc3", password: PW });
  assert.equal(locked.status, 423);
  const ev = await h.app.db.query("SELECT 1 FROM security_events e JOIN users u ON u.id = e.user_id WHERE u.username = 'conc3' AND kind = 'login.lockout'");
  assert.equal(ev.rowCount, 1);
});

test("CSRF and cross-origin protection on authenticated writes", async () => {
  const c = new Client(h.base);
  await c.post("/api/auth/login", { identifier: "conc4", password: PW });
  const noToken = await c.post("/api/account/sessions/revoke-others", {}, { "x-csrf-token": "" });
  assert.equal(noToken.status, 403);
  assert.equal(noToken.body.error.message, "Invalid CSRF token");
  const foreign = await c.post("/api/account/sessions/revoke-others", {}, { origin: "https://evil.example" });
  assert.equal(foreign.status, 403);
  const ok = await c.post("/api/account/sessions/revoke-others", {});
  assert.equal(ok.status, 200);
  const form = await fetch(h.base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost:3999" }, body: "identifier=conc4&password=x" });
  assert.equal(form.status, 415);
});

test("5: email verification works once", async () => {
  const c = new Client(h.base);
  await c.post("/api/auth/login", { identifier: "jay", password: PW });
  assert.equal((await c.get("/api/auth/me")).body.user.emailVerified, false);
  const token = await lastEmailToken(h.app, "jay@example.com", "verify_email");
  assert.ok(token);
  assert.equal((await c.post("/api/auth/verify-email", { token })).status, 200);
  assert.equal((await c.get("/api/auth/me")).body.user.emailVerified, true);
  assert.equal((await c.post("/api/auth/verify-email", { token })).body.error.code, "invalid_token");
});

test("6: password recovery resets the password and revokes every session", async () => {
  const old = new Client(h.base);
  await old.post("/api/auth/login", { identifier: "conc5", password: PW });
  const anon = new Client(h.base);
  assert.deepEqual((await anon.post("/api/auth/forgot-password", { identifier: "conc5" })).body, { status: "accepted" });
  assert.deepEqual((await anon.post("/api/auth/forgot-password", { identifier: "nobody-here" })).body, { status: "accepted" });
  const token = await lastEmailToken(h.app, "conc5@example.com", "reset_password");
  assert.equal((await anon.post("/api/auth/reset-password", { token, password: "short" })).status, 400);
  // The failed attempt rolled back, so the token is still usable.
  assert.equal((await anon.post("/api/auth/reset-password", { token, password: "Brand-New-Pass-9" })).status, 200);
  assert.equal((await old.get("/api/auth/me")).body.user, null);
  assert.equal((await new Client(h.base).post("/api/auth/login", { identifier: "conc5", password: PW })).status, 401);
  assert.equal((await new Client(h.base).post("/api/auth/login", { identifier: "conc5", password: "Brand-New-Pass-9" })).status, 200);
  assert.equal((await anon.post("/api/auth/reset-password", { token, password: "Another-Pass-10" })).body.error.code, "invalid_token");
});

test("two-factor: setup, enforced at login, recovery codes are single-use", async () => {
  const c = new Client(h.base);
  await c.post("/api/auth/login", { identifier: "conc6", password: PW });
  const setup = await c.post("/api/account/2fa/setup");
  const secret = base32Decode(setup.body.secret);
  assert.equal((await c.post("/api/account/2fa/enable", { code: "000000" })).body.error.code, "invalid_code");
  const en = await c.post("/api/account/2fa/enable", { code: totp(secret) });
  assert.equal(en.body.recoveryCodes.length, 10);

  const d = new Client(h.base);
  const login = await d.post("/api/auth/login", { identifier: "conc6", password: PW });
  assert.equal(login.body.mfaRequired, true);
  assert.equal((await d.get("/api/account/sessions")).body.error.code, "mfa_required");
  assert.equal((await d.post("/api/auth/2fa/verify", { code: totp(secret) })).status, 200);
  assert.equal((await d.get("/api/account/sessions")).status, 200);

  const e = new Client(h.base);
  await e.post("/api/auth/login", { identifier: "conc6", password: PW });
  assert.equal((await e.post("/api/auth/2fa/verify", { code: en.body.recoveryCodes[0] })).status, 200);
  const f = new Client(h.base);
  await f.post("/api/auth/login", { identifier: "conc6", password: PW });
  assert.equal((await f.post("/api/auth/2fa/verify", { code: en.body.recoveryCodes[0] })).body.error.code, "invalid_code");
});

test("new-device sign-in is flagged and the user is notified", async () => {
  const c = new Client(h.base, "172.20.1.5", "Mozilla/5.0 (Macintosh; Mac OS X) Firefox/131");
  await c.post("/api/auth/login", { identifier: "conc7", password: PW });
  const hist = await c.get("/api/account/login-history");
  assert.equal(hist.body[0].suspicious, true);
  const n = await c.get("/api/account/notifications");
  assert.ok(n.body.some((x: any) => x.kind === "security"));
});

test("8: account deletion is safe — UID kept, username freed, UID never reused", async () => {
  const c = new Client(h.base);
  await c.post("/api/auth/login", { identifier: "conc2", password: PW });
  const uid = (await c.get("/api/auth/me")).body.user.uid;
  assert.equal((await c.post("/api/account/delete", { confirmUsername: "wrong", password: PW })).status, 400);
  assert.equal((await c.post("/api/account/delete", { confirmUsername: "conc2", password: PW })).status, 200);
  assert.equal((await c.get("/api/auth/me")).body.user, null);
  assert.equal((await new Client(h.base).post("/api/auth/login", { identifier: "conc2", password: PW })).status, 401);
  const row = (await h.app.db.query("SELECT uid, email, password_hash, status FROM users WHERE uid = $1", [uid])).rows[0];
  assert.deepEqual([row.email, row.password_hash, row.status], [null, null, "deleted"]);
  const max = (await h.app.db.query("SELECT max(uid)::int AS m FROM users")).rows[0].m;
  const again = await new Client(h.base).post("/api/auth/register", { username: "conc2", email: "conc2b@example.com", password: PW, acceptTos: true });
  assert.equal(again.status, 200);
  assert.equal(again.body.user.uid, max + 1);
  assert.notEqual(again.body.user.uid, uid);
});

test("bans and admin locks end sessions and block login", async () => {
  const c = new Client(h.base);
  await c.post("/api/auth/login", { identifier: "conc1", password: PW });
  const id = (await h.app.db.query("SELECT id FROM users WHERE username = 'conc1'")).rows[0].id;
  await h.app.db.query("INSERT INTO account_bans (user_id, reason, expires_at) VALUES ($1, 'spam', now() + interval '1 day')", [id]);
  assert.equal((await c.get("/api/auth/me")).body.user, null);
  const l = await new Client(h.base).post("/api/auth/login", { identifier: "conc1", password: PW });
  assert.equal(l.body.error.code, "account_banned");
  await h.app.db.query("UPDATE account_bans SET lifted_at = now() WHERE user_id = $1", [id]);
  await h.app.db.query("INSERT INTO account_locks (user_id, reason) VALUES ($1, 'review')", [id]);
  assert.equal((await new Client(h.base).post("/api/auth/login", { identifier: "conc1", password: PW })).body.error.code, "account_locked");
});
