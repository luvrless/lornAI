/** Acceptance 58–62 and the admin control center: users, moderation, reports, support, stats. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { startHarness, Harness, Client, newUser, ownerClient, staffClient, lastEmailToken } from "./helpers.ts";
import { closeHashPool } from "../server/lib/password.ts";
import { deliverEmails } from "../server/modules/jobs/schedules.ts";
import { sendMail } from "../server/lib/smtp.ts";

let h: Harness, owner: Client, admin: Client, staff: Client;
let alice: Awaited<ReturnType<typeof newUser>>, bob: Awaited<ReturnType<typeof newUser>>;
const PW = "Sunset-Driver-77";
before(async () => {
  h = await startHarness();
  alice = await newUser(h, "alice");
  bob = await newUser(h, "bob");
  owner = await ownerClient(h);
  admin = await staffClient(h, owner, "222222222222222222", "boss", "ADMIN");
  staff = await staffClient(h, owner, "111111111111111111", "modguy", "STAFF");
});
after(async () => { await h.close(); await closeHashPool(); });
const ownerId = async () => (await h.app.db.query("SELECT id FROM users WHERE username = 'q5'")).rows[0].id;

test("58: user search by username, UID, email, Discord ID with filters and pagination", async () => {
  assert.equal((await admin.get("/api/admin/users?q=ali")).body.items[0].username, "alice");
  assert.equal((await admin.get(`/api/admin/users?q=${alice.uid}`)).body.items[0].username, "alice");
  assert.equal((await admin.get("/api/admin/users?q=alice@example.com")).body.items[0].username, "alice");
  assert.equal((await admin.get("/api/admin/users?q=222222222222222222")).body.items[0].username, "boss");
  assert.equal((await admin.get("/api/admin/users?role=OWNER")).body.items[0].username, "q5");
  const page = (await admin.get("/api/admin/users?limit=2&sort=uid")).body;
  assert.equal(page.items.length, 2);
  assert.equal(page.total, 5);
  // Staff can search but never see emails.
  const s = (await staff.get("/api/admin/users?q=alice")).body.items[0];
  assert.equal(s.email, null);
  assert.equal((await staff.get("/api/admin/users?q=alice@example.com")).body.total, 0);
  assert.equal((await new Client(h.base).get("/api/admin/users")).status, 401);
});

test("user inspection never exposes password hashes", async () => {
  const r = await admin.get(`/api/admin/users/${alice.userId}`);
  assert.equal(r.body.account.username, "alice");
  assert.ok(!JSON.stringify(r.body).includes("argon2"));
  assert.ok(Array.isArray(r.body.security.logins));
});

test("59: administrative account changes persist and are audited", async () => {
  assert.equal((await staff.post(`/api/admin/users/${alice.userId}/username`, { username: "alicia", reason: "requested" })).status, 403);
  assert.equal((await admin.post(`/api/admin/users/${alice.userId}/username`, { username: "admin", reason: "nope" })).body.error.message, "This username is reserved");
  assert.equal((await admin.post(`/api/admin/users/${alice.userId}/username`, { username: "alicia", reason: "user requested via ticket" })).status, 204);
  assert.equal((await alice.get("/api/auth/me")).body.user.username, "alicia");
  assert.equal((await admin.post(`/api/admin/users/${alice.userId}/email`, { email: "new@example.com", reason: "lost access" })).status, 204);
  const me = (await alice.get("/api/auth/me")).body.user;
  assert.deepEqual([me.email, me.emailVerified], ["new@example.com", false]);
  assert.equal((await admin.post(`/api/admin/users/${alice.userId}/recover`, { reason: "user locked out" })).status, 200);
  assert.ok(await lastEmailToken(h.app, "new@example.com", "reset_password"));
  const audit = (await owner.get(`/api/admin/users/${alice.userId}/audit`)).body.map((a: any) => a.action);
  assert.deepEqual(audit.slice(0, 3), ["user.password_recovery_initiated", "user.email_changed", "user.username_changed"]);
});

test("60: locks and temporary/permanent bans work, with permission separation", async () => {
  await admin.post(`/api/admin/users/${bob.userId}/lock`, { reason: "suspicious" });
  assert.equal((await bob.get("/api/auth/me")).body.user, null);
  assert.equal((await new Client(h.base).post("/api/auth/login", { identifier: "bob", password: PW })).body.error.code, "account_locked");
  assert.equal((await admin.get("/api/admin/users?locked=true")).body.items[0].username, "bob");
  await admin.post(`/api/admin/users/${bob.userId}/unlock`, { reason: "verified identity" });
  const c = new Client(h.base);
  assert.equal((await c.post("/api/auth/login", { identifier: "bob", password: PW })).status, 200);

  assert.equal((await admin.post(`/api/admin/users/${bob.userId}/ban`, { reason: "spam spam", expiresAt: null })).body.error.message, "Missing permission: users.ban_permanent");
  assert.equal((await staff.post(`/api/admin/users/${bob.userId}/ban`, { reason: "spam spam", expiresAt: new Date(Date.now() + 86400_000) })).status, 403);
  assert.equal((await admin.post(`/api/admin/users/${bob.userId}/ban`, { reason: "spam links", expiresAt: new Date(Date.now() + 86400_000) })).status, 204);
  assert.equal((await c.get("/api/auth/me")).body.user, null);
  assert.equal((await new Client(h.base).get("/api/p/bob")).body.error.code, "profile_banned");
  assert.match((await new Client(h.base).post("/api/auth/login", { identifier: "bob", password: PW })).body.error.message, /banned until/);
  await admin.post(`/api/admin/users/${bob.userId}/unban`, { reason: "appeal accepted" });
  assert.equal((await owner.post(`/api/admin/users/${bob.userId}/ban`, { reason: "repeat offence", expiresAt: null })).status, 204);
  assert.match((await new Client(h.base).post("/api/auth/login", { identifier: "bob", password: PW })).body.error.message, /permanently/);
  await owner.post(`/api/admin/users/${bob.userId}/unban`, { reason: "test cleanup" });
});

test("55/owner protection: nobody but the owner can act on the owner; staff can't act on peers", async () => {
  const oid = await ownerId();
  for (const [path, body] of [["lock", { reason: "x x x" }], ["ban", { reason: "x x x", expiresAt: new Date(Date.now() + 1e6) }], ["username", { username: "hacked", reason: "x x x" }], ["delete", { reason: "x x x", confirmUsername: "q5" }]] as const) {
    const r = await admin.post(`/api/admin/users/${oid}/${path}`, body);
    assert.equal(r.status, 403, path);
  }
  const bossId = (await h.app.db.query("SELECT id FROM users WHERE username = 'boss'")).rows[0].id;
  const modId = (await h.app.db.query("SELECT id FROM users WHERE username = 'modguy'")).rows[0].id;
  assert.equal((await staff.post(`/api/admin/users/${bossId}/warn`, { reason: "nope nope" })).body.error.message, "You can't take action against a admin");
  assert.equal((await admin.post(`/api/admin/users/${bossId}/lock`, { reason: "self lock" })).body.error.message, "You can't perform this action on your own account");
  assert.equal((await admin.post(`/api/admin/users/${modId}/warn`, { reason: "be nicer" })).status, 204);
});

test("61: reports flow through the moderation queue and every decision is recorded", async () => {
  assert.equal((await bob.post("/api/auth/login", { identifier: "bob", password: PW })).status, 200); // the lock above revoked his sessions
  const rep = await bob.post("/api/reports", { targetType: "profile", username: "alicia", category: "impersonation", description: "Pretending to be a well-known streamer", evidenceUrls: ["https://example.com/proof"] });
  assert.equal(rep.status, 200, JSON.stringify(rep.body));
  assert.equal((await bob.post("/api/reports", { targetType: "profile", username: "bob", category: "spam", description: "reporting myself here" })).status, 400);
  const q = (await staff.get("/api/admin/reports?status=pending")).body;
  assert.equal(q.items[0].target_username, "alicia");
  await staff.patch(`/api/admin/reports/${rep.body.id}`, { status: "under_review", assignToMe: true, note: "looking into it" });
  assert.equal((await staff.patch(`/api/admin/reports/${rep.body.id}`, { status: "resolved", resolution: "x" })).status, 403); // needs moderation.manage
  await admin.post(`/api/admin/users/${alice.userId}/profile-visibility`, { hidden: true, reason: "impersonation confirmed" });
  assert.equal((await admin.patch(`/api/admin/reports/${rep.body.id}`, { status: "resolved" })).body.error.message, "Add a resolution or reason");
  await admin.patch(`/api/admin/reports/${rep.body.id}`, { status: "resolved", resolution: "Profile hidden for impersonation" });
  const full = (await admin.get(`/api/admin/reports/${rep.body.id}`)).body;
  assert.equal(full.status, "resolved");
  assert.equal(full.notes[0].body, "looking into it");
  assert.equal(full.evidence[0].url, "https://example.com/proof");
  assert.deepEqual(full.actions.map((a: any) => [a.previous_status, a.new_status]), [["pending", "under_review"], ["under_review", "resolved"]]);
  assert.ok(full.actions.every((a: any) => a.moderator && a.reason && a.at));
  const hist = (await admin.get(`/api/admin/users/${alice.userId}`)).body.moderation.actions;
  assert.deepEqual(hist.map((a: any) => a.action).slice(0, 2), ["report_status", "hide_profile"]);
  assert.equal((await bob.get("/api/reports/mine")).body[0].status, "resolved");
  assert.equal((await new Client(h.base).get("/api/p/alicia")).body.error.code, "profile_hidden");
});

test("support tickets: user ↔ staff conversation with internal notes kept private", async () => {
  const t = await bob.post("/api/support/tickets", { category: "account", subject: "Can't change avatar", body: "The upload keeps failing for me." });
  assert.equal(t.status, 200);
  await staff.post(`/api/admin/tickets/${t.body.id}/messages`, { body: "User is on mobile Safari — check upload size", internal: true });
  await staff.post(`/api/admin/tickets/${t.body.id}/messages`, { body: "Could you try a smaller image?" });
  const mine = (await bob.get(`/api/support/tickets/${t.body.id}`)).body;
  assert.equal(mine.messages.length, 2);
  assert.ok(!JSON.stringify(mine).includes("mobile Safari"));
  assert.equal(mine.status, "awaiting_user");
  assert.equal((await staff.get(`/api/admin/tickets/${t.body.id}`)).body.messages.length, 3);
  assert.equal((await alice.get(`/api/support/tickets/${t.body.id}`)).status, 404); // other users can't read it
  await bob.post(`/api/support/tickets/${t.body.id}/messages`, { body: "That worked, thanks!" });
  await bob.post(`/api/support/tickets/${t.body.id}/close`);
  assert.equal((await bob.post(`/api/support/tickets/${t.body.id}/messages`, { body: "one more" })).status, 409);
  await admin.patch(`/api/admin/tickets/${t.body.id}`, { status: "escalated", priority: "high" });
  assert.equal((await bob.get("/api/account/notifications")).body.some((n: any) => n.kind === "support"), true);
});

test("account deletion by admin requires typed confirmation and keeps the UID", async () => {
  const victim = await newUser(h, "spammer");
  assert.equal((await admin.post(`/api/admin/users/${victim.userId}/delete`, { reason: "spam bot", confirmUsername: "spammer" })).status, 403); // admin lacks users.delete
  assert.equal((await owner.post(`/api/admin/users/${victim.userId}/delete`, { reason: "spam bot", confirmUsername: "wrong" })).status, 400);
  assert.equal((await owner.post(`/api/admin/users/${victim.userId}/delete`, { reason: "spam bot", confirmUsername: "spammer" })).status, 204);
  const u = (await owner.get(`/api/admin/users/${victim.userId}`)).body.account;
  assert.deepEqual([u.status, u.uid], ["deleted", victim.uid]);
  assert.equal((await owner.get("/api/admin/users?status=deleted")).body.items[0].username, "spammer");
});

test("announcements appear for users once published", async () => {
  const a = await admin.post("/api/admin/announcements", { title: "Christmas event", body: "Snowflake badges on the 24th!", published: false });
  assert.equal((await bob.get("/api/announcements")).body.length, 0);
  await admin.patch(`/api/admin/announcements/${a.body.id}`, { published: true });
  assert.equal((await bob.get("/api/announcements")).body[0].title, "Christmas event");
  assert.equal((await staff.post("/api/admin/announcements", { title: "x", body: "y" })).status, 403);
});

test("admin dashboard reports real numbers from the database", async () => {
  const d = (await owner.get("/api/admin/dashboard")).body;
  const live = Number((await h.app.db.query("SELECT count(*) FROM users WHERE deleted_at IS NULL")).rows[0].count);
  assert.equal(d.platform.live_accounts, live);
  assert.equal(d.platform.total_registrations, live + 1); // one deleted account still counts
  assert.equal(d.moderation.pending_reports, 0);
  assert.ok(d.charts.registrations.length >= 30);
  assert.ok(d.alerts.some((x: any) => /email/.test(x.message)));
  // Staff get the dashboard without monetization data.
  assert.equal((await staff.get("/api/admin/dashboard")).body.monetization, null);
});

test("62: every sensitive admin action produced an audit record", async () => {
  const actions = new Set((await owner.get("/api/admin/audit?limit=500")).body.rows.map((r: any) => r.action));
  for (const a of ["user.username_changed", "user.email_changed", "user.password_recovery_initiated", "user.locked", "user.unlocked", "user.banned", "user.unbanned",
    "user.warned", "profile.hidden", "report.status_changed", "user.deleted", "announcement.created", "staff.added", "admin.session_started"]) {
    assert.ok(actions.has(a), `missing ${a}`);
  }
  assert.deepEqual((await owner.get("/api/admin/audit/verify")).body, { intact: true, firstBrokenId: null });
});

test("email delivery: the outbox is sent over SMTP once configured", async () => {
  // Local SMTP sink speaking the real protocol.
  const got: string[] = [];
  const srv = net.createServer((s) => {
    s.write("220 sink ESMTP\r\n");
    let data = false, buf = "";
    s.on("data", (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) { if (line === ".") { data = false; s.write("250 queued\r\n"); } else got.push(line); continue; }
        if (/^EHLO/.test(line)) s.write("250-sink\r\n250 AUTH PLAIN\r\n");
        else if (/^AUTH PLAIN/.test(line)) s.write(Buffer.from(line.split(" ")[2], "base64").toString() === "\0u\0p" ? "235 ok\r\n" : "535 no\r\n");
        else if (/^(MAIL|RCPT)/.test(line)) s.write("250 ok\r\n");
        else if (line === "DATA") { data = true; s.write("354 go\r\n"); }
        else if (line === "QUIT") { s.write("221 bye\r\n"); s.end(); }
      }
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const port = (srv.address() as net.AddressInfo).port;
  const url = `smtp://u:p@127.0.0.1:${port}?insecure=1`;
  await sendMail(url, { from: "LORN <no-reply@lorn.lol>", to: "x@example.com", subject: "Hëllo", text: "line1\n.line2" });
  assert.ok(got.some((l) => l.startsWith("Subject: =?UTF-8?B?")));
  (h.app.cfg as any).smtp = { url, from: "LORN <no-reply@lorn.lol>" };
  await h.app.db.query("UPDATE email_outbox SET status = 'pending' WHERE status = 'not_configured'");
  const sent = await deliverEmails(h.app, 100);
  assert.ok(sent > 0);
  assert.equal((await h.app.db.query("SELECT count(*)::int AS n FROM email_outbox WHERE status = 'pending'")).rows[0].n, 0);
  srv.close();
});
