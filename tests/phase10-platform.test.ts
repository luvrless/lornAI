/**
 * Multi-user guarantees and platform plumbing: every visitor has their own session,
 * usernames are checked against the database, the admin panel is server-enforced,
 * dynamic responses are never cacheable, totals are real, and mail goes out through Resend.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import { startHarness, Harness, Client } from "./helpers.ts";
import { closeHashPool } from "../server/lib/password.ts";
import { deliverEmails } from "../server/modules/jobs/schedules.ts";

let h: Harness;
before(async () => { h = await startHarness(); });
after(async () => { await h.close(); await closeHashPool(); });

const reg = async (c: Client, username: string) => c.post("/api/auth/register", { username, email: `${username}@example.com`, password: "Sunset-Driver-77", acceptTos: true });

test("accounts are isolated: one person's sign-up never signs anyone else in", async () => {
  const a = new Client(h.base), b = new Client(h.base), visitor = new Client(h.base);
  assert.equal((await visitor.get("/api/auth/me")).body.user, null);
  assert.equal((await reg(a, "alice")).status, 200);
  assert.equal((await visitor.get("/api/auth/me")).body.user, null, "a fresh visitor stays signed out");
  assert.equal((await reg(b, "bob")).status, 200);
  const ma = (await a.get("/api/auth/me")).body, mb = (await b.get("/api/auth/me")).body;
  assert.equal(ma.user.username, "alice"); assert.equal(mb.user.username, "bob");
  assert.notEqual(ma.user.id, mb.user.id); assert.notEqual(ma.user.uid, mb.user.uid);
  assert.equal(ma.app, "lorn");
  // Each account edits only its own profile.
  const ea = (await a.get("/api/profile/editor")).body;
  ea.draft.identity.bio = "alice only";
  assert.equal((await a.put("/api/profile/draft", { config: ea.draft, rev: ea.rev })).status, 200);
  assert.equal((await b.get("/api/profile/editor")).body.draft.identity.bio, "");
  // Private endpoints refuse the signed-out visitor.
  for (const p of ["/api/profile/editor", "/api/dashboard/overview", "/api/account/notifications", "/api/profile/status"]) assert.equal((await visitor.get(p)).status, 401, p);
  // Logging out one session leaves the other alone, and the existing account can log back in.
  await a.post("/api/auth/logout");
  assert.equal((await a.get("/api/auth/me")).body.user, null);
  assert.equal((await b.get("/api/auth/me")).body.user.username, "bob");
  const again = new Client(h.base);
  assert.equal((await again.post("/api/auth/login", { identifier: "ALICE", password: "Sunset-Driver-77" })).status, 200);
  assert.equal((await again.get("/api/auth/me")).body.user.username, "alice");
  assert.equal((await new Client(h.base).post("/api/auth/login", { identifier: "alice", password: "wrong-password-1" })).status, 401);
});

test("the header status is accurate: starter → live → unpublished changes → live", async () => {
  const c = new Client(h.base);
  await c.post("/api/auth/login", { identifier: "bob", password: "Sunset-Driver-77" });
  const st = async () => (await c.get("/api/profile/status")).body;
  assert.deepEqual([(await st()).isPublished, (await st()).hasUnpublishedChanges], [false, true]);
  await c.post("/api/profile/publish", {});
  assert.deepEqual([(await st()).isPublished, (await st()).hasUnpublishedChanges], [true, false]);
  const e = (await c.get("/api/profile/editor")).body;
  e.draft.identity.bio = "new bio";
  await c.put("/api/profile/draft", { config: e.draft, rev: e.rev });
  assert.equal((await st()).hasUnpublishedChanges, true);
  await c.post("/api/profile/publish", {});
  assert.equal((await st()).hasUnpublishedChanges, false);
  await c.post("/api/profile/unpublish");
});

test("username check reads the database: taken, case-insensitive, free", async () => {
  const v = new Client(h.base);
  assert.deepEqual((await v.get("/api/auth/username/alice")).body.available, false);
  assert.deepEqual((await v.get("/api/auth/username/ALICE")).body.available, false);
  assert.deepEqual((await v.get("/api/auth/username/Bob")).body.available, false);
  assert.deepEqual((await v.get("/api/auth/username/carol")).body.available, true);
  const dup = await reg(new Client(h.base), "Alice");
  assert.equal(dup.status, 409);
});

test("admin panel is refused on the server for visitors and ordinary members", async () => {
  const visitor = new Client(h.base), member = new Client(h.base);
  await member.post("/api/auth/login", { identifier: "bob", password: "Sunset-Driver-77" });
  const me = (await member.get("/api/auth/me")).body;
  assert.equal(me.adminPanel, false); assert.equal(me.staffRole, null);
  for (const c of [visitor, member]) for (const p of ["/api/admin/session", "/api/admin/users", "/api/admin/overview"]) {
    const r = await c.get(p);
    assert.ok([401, 403, 404].includes(r.status), `${p} → ${r.status}`);
    assert.ok(!r.body?.users && !r.body?.rows);
  }
});

test("dynamic responses are private and uncacheable; totals are real counts", async () => {
  const r = await fetch(`${h.base}/api/auth/me`);
  assert.match(r.headers.get("cache-control")!, /private/); assert.match(r.headers.get("cache-control")!, /no-store/);
  assert.equal(r.headers.get("cdn-cache-control"), "no-store"); assert.match(r.headers.get("vary") ?? "", /Cookie/i);
  assert.match((await fetch(`${h.base}/`)).headers.get("cache-control")!, /private/);
  const s = await (await fetch(`${h.base}/api/public/stats`)).json();
  assert.deepEqual(s, { members: 2, views: 0, live: 0 });
  assert.equal((await (await fetch(`${h.base}/api/health`)).json()).app, "lorn");
});

test("Discord sign-in is always reachable; when unconfigured it explains itself instead of erroring", async () => {
  const start = await fetch(`${h.base}/api/auth/discord/start?intent=login`, { redirect: "manual" });
  assert.equal(start.status, 302);
  assert.ok(start.headers.get("location")!.startsWith(h.discord.url + "/authorize"));
  const saved = h.app.cfg.discord;
  (h.app.cfg as any).discord = null;
  try {
    const off = await fetch(`${h.base}/api/auth/discord/start?intent=login`, { redirect: "manual" });
    assert.equal(off.status, 302); assert.equal(off.headers.get("location"), "/login?error=discord_not_configured");
  } finally { (h.app.cfg as any).discord = saved; }
});

test("account emails are delivered through the Resend API, once each", async () => {
  const got: any[] = [];
  const srv = http.createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
    got.push({ url: req.url, auth: req.headers.authorization, key: req.headers["idempotency-key"], body: JSON.parse(Buffer.concat(chunks).toString()) });
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ id: "re_" + got.length }));
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  (h.app.cfg as any).resend = { apiKey: "re_test_key", apiBase: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, from: "LORN.LOL <no-reply@lorn.lol>", replyTo: null };
  try {
    assert.equal((await (await fetch(`${h.base}/api/auth/providers`)).json()).email, true);
    const c = new Client(h.base);
    const r = await reg(c, "dana");
    assert.equal(r.body.verificationEmail, "pending");
    await new Client(h.base).post("/api/auth/forgot-password", { identifier: "dana@example.com" });
    assert.equal(await deliverEmails(h.app), 2);
    assert.equal(await deliverEmails(h.app), 0, "nothing is sent twice");
    assert.equal(got.length, 2);
    assert.equal(got[0].url, "/emails"); assert.equal(got[0].auth, "Bearer re_test_key");
    assert.match(got[0].key, /^lorn-outbox-\d+$/); assert.notEqual(got[0].key, got[1].key);
    assert.deepEqual(got[0].body.to, ["dana@example.com"]); assert.equal(got[0].body.from, "LORN.LOL <no-reply@lorn.lol>");
    assert.ok(got[0].body.html.includes("verify-email") && got[1].body.html.includes("reset-password"), "sent oldest first");
    const rows = (await h.app.db.query("SELECT status FROM email_outbox WHERE to_address = 'dana@example.com'")).rows;
    assert.deepEqual(rows.map((x: any) => x.status), ["sent", "sent"]);
  } finally { (h.app.cfg as any).resend = null; srv.close(); }
});
