/** Acceptance tests 51–57, 62–63, 74: Discord OAuth, owner, staff, permissions, audit. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startHarness, Harness, Client, OWNER_ID } from "./helpers.ts";
import { closeHashPool } from "../server/lib/password.ts";
import { ALL_PERMISSIONS, ROLE_DEFAULTS } from "../server/modules/authz/registry.ts";

let h: Harness;
before(async () => { h = await startHarness(); });
after(async () => { await h.close(); await closeHashPool(); });

const STAFF_ID = "111111111111111111";
const ADMIN_ID = "222222222222222222";
const RANDO_ID = "333333333333333333";
const owner = () => new Client(h.base);
let ownerC: Client, adminC: Client, staffC: Client;

test("51: Discord OAuth — state is required, bound to the browser and single-use", async () => {
  const c = new Client(h.base);
  const r = await c.discord(h, RANDO_ID, "rando");
  assert.equal(r.status, 302);
  assert.equal(r.authorizeUrl!.searchParams.get("scope"), "identify");
  assert.equal(r.authorizeUrl!.searchParams.get("client_id"), "test-client");
  assert.equal(r.location, "/signup/complete");
  const pending = await c.get("/api/auth/signup/pending");
  assert.equal(pending.body.provider, "discord");
  assert.equal(pending.body.suggestedUsername, "rando");
  const done = await c.post("/api/auth/signup/complete", { username: "rando", acceptTos: true });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.isOwner, false);
  const me = await c.get("/api/auth/me");
  assert.equal(me.body.connections[0].providerUserId, RANDO_ID);
  assert.equal(me.body.staffRole, null);

  // Logging in again with the same Discord ID reuses the account.
  const again = new Client(h.base);
  const r2 = await again.discord(h, RANDO_ID, "rando");
  assert.equal(r2.location, "/dashboard");
  assert.equal((await again.get("/api/auth/me")).body.user.username, "rando");

  // Forged state from another browser is rejected before any token exchange.
  const victim = new Client(h.base);
  const start = await victim.get("/api/auth/discord/start");
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const attacker = new Client(h.base);
  const before = h.discord.tokenRequests;
  const forged = await attacker.get(`/api/auth/discord/callback?code=anything&state=${state}`);
  assert.equal(forged.headers.get("location"), "/login?error=oauth_state_mismatch");
  assert.equal(h.discord.tokenRequests, before);
  // Replay of a consumed state fails.
  h.discord.codes.set("c1", RANDO_ID);
  await victim.get(`/api/auth/discord/callback?code=c1&state=${state}`);
  victim.jar.set("lorn_oauth", state);
  const replay = await victim.get(`/api/auth/discord/callback?code=c1&state=${state}`);
  assert.equal(replay.headers.get("location"), "/login?error=oauth_state_expired");
});

test("53: unauthorized users cannot reach admin APIs", async () => {
  assert.equal((await new Client(h.base).get("/api/admin/whoami")).status, 401);
  const rando = new Client(h.base);
  await rando.discord(h, RANDO_ID, "rando");
  assert.equal((await rando.get("/api/admin/whoami")).body.error.code, "admin_required");
  const denied = await rando.discord(h, RANDO_ID, "rando", "admin");
  assert.equal(denied.location, "/admin/denied");
  assert.equal((await rando.get("/api/admin/staff")).status, 403);
  const ev = await h.app.db.query("SELECT 1 FROM security_events WHERE kind = 'admin.access_denied'");
  assert.ok(ev.rowCount! >= 1);
});

test("52: the configured owner Discord ID receives OWNER with every permission", async () => {
  ownerC = owner();
  const r = await ownerC.discord(h, OWNER_ID, "q5", "admin");
  assert.equal(r.location, "/signup/complete?next=/admin");
  const done = await ownerC.post("/api/auth/signup/complete", { username: "q5", acceptTos: true });
  assert.equal(done.body.isOwner, true);
  assert.equal((await ownerC.get("/api/auth/me")).body.staffRole, "OWNER");
  // Signed in but not elevated yet: admin needs a Discord round-trip.
  assert.equal((await ownerC.get("/api/admin/whoami")).status, 403);
  const el = await ownerC.discord(h, OWNER_ID, "q5", "admin");
  assert.equal(el.location, "/admin");
  await ownerC.refreshCsrf();
  const who = await ownerC.get("/api/admin/whoami");
  assert.equal(who.body.role, "OWNER");
  assert.equal(who.body.permissions.length, ALL_PERMISSIONS.length);
});

test("owner identity cannot be faked by username or by a staff DB record", async () => {
  const imp = new Client(h.base);
  await imp.discord(h, "444444444444444444", "q5"); // same Discord username, different ID
  await imp.post("/api/auth/signup/complete", { username: "q5fake", acceptTos: true });
  assert.equal((await imp.discord(h, "444444444444444444", "q5", "admin")).location, "/admin/denied");
  // Even a direct insert of the owner ID into staff can't demote the owner.
  await h.app.db.query("INSERT INTO staff_authorizations (discord_id, role) VALUES ($1, 'STAFF')", [OWNER_ID]);
  assert.equal((await ownerC.get("/api/admin/whoami")).body.role, "OWNER");
  await h.app.db.query("DELETE FROM staff_authorizations WHERE discord_id = $1", [OWNER_ID]);
});

test("54: staff authorized by Discord ID before registering get only STAFF permissions", async () => {
  const add = await ownerC.post("/api/admin/staff", { discordId: STAFF_ID, role: "STAFF", note: "mod team" });
  assert.equal(add.status, 200, JSON.stringify(add.body));
  const list = await ownerC.get("/api/admin/staff");
  assert.equal(list.body.staff[0].linked_uid, null); // not registered yet
  staffC = new Client(h.base);
  await staffC.discord(h, STAFF_ID, "modguy", "admin");
  await staffC.post("/api/auth/signup/complete", { username: "modguy", acceptTos: true });
  await staffC.discord(h, STAFF_ID, "modguy", "admin");
  await staffC.refreshCsrf();
  const who = await staffC.get("/api/admin/whoami");
  assert.equal(who.body.role, "STAFF");
  assert.deepEqual(who.body.permissions, [...ROLE_DEFAULTS.STAFF].sort());
  assert.equal((await ownerC.get("/api/admin/staff")).body.staff[0].linked_username, "modguy"); // auto-associated
  assert.equal((await staffC.post("/api/admin/staff", { discordId: "555555555555555555", role: "STAFF" })).status, 403);
  assert.equal((await staffC.get("/api/admin/settings")).status, 403);
  assert.equal((await staffC.get("/api/admin/audit")).status, 403);
});

test("55: administrators cannot touch the owner, themselves, or other admins", async () => {
  await ownerC.post("/api/admin/staff", { discordId: ADMIN_ID, role: "ADMIN" });
  adminC = new Client(h.base);
  await adminC.discord(h, ADMIN_ID, "boss", "admin");
  await adminC.post("/api/auth/signup/complete", { username: "boss", acceptTos: true });
  await adminC.discord(h, ADMIN_ID, "boss", "admin");
  await adminC.refreshCsrf();
  const who = await adminC.get("/api/admin/whoami");
  assert.equal(who.body.role, "ADMIN");
  for (const p of ["admins.manage", "permissions.manage", "payments.manage", "settings.edit_protected"]) assert.ok(!who.body.permissions.includes(p));

  const staff = (await ownerC.get("/api/admin/staff")).body.staff;
  const adminRec = staff.find((s: any) => s.discord_id === ADMIN_ID);
  const staffRec = staff.find((s: any) => s.discord_id === STAFF_ID);
  // No staff.manage by default.
  assert.equal((await adminC.patch(`/api/admin/staff/${staffRec.id}`, { active: false })).status, 403);
  // Even if the owner grants staff.manage, an admin can't promote, self-edit, or grant owner-only perms.
  await ownerC.put(`/api/admin/staff/${adminRec.id}/permissions/staff.manage`, { state: "grant" });
  assert.equal((await adminC.patch(`/api/admin/staff/${staffRec.id}`, { role: "ADMIN" })).body.error.message, "Only the owner can manage administrators");
  assert.equal((await adminC.patch(`/api/admin/staff/${adminRec.id}`, { note: "me" })).body.error.message, "You cannot change your own authorization");
  assert.equal((await adminC.put(`/api/admin/staff/${adminRec.id}/permissions/users.delete`, { state: "grant" })).status, 403);
  assert.equal((await adminC.post("/api/admin/staff", { discordId: OWNER_ID, role: "STAFF" })).body.error.message, "The platform owner cannot be modified");
  assert.equal((await ownerC.put(`/api/admin/staff/${adminRec.id}/permissions/admins.manage`, { state: "grant" })).body.error.message, "This permission is reserved for the owner");
  // Protected settings are owner-only.
  await ownerC.put(`/api/admin/staff/${adminRec.id}/permissions/settings.edit`, { state: "grant" });
  assert.equal((await adminC.put("/api/admin/settings/maintenance.enabled", { value: true })).body.error.message, "This setting is protected and can only be changed by the owner");
  assert.equal((await adminC.put("/api/admin/settings/registration.enabled", { value: true })).status, 200);
  // An admin can't revoke the owner's admin sessions.
  const sessions = (await adminC.get("/api/admin/security/admin-sessions")).body;
  const ownerSession = sessions.find((s: any) => s.discord_id === OWNER_ID);
  assert.equal((await adminC.del(`/api/admin/security/admin-sessions/${ownerSession.id}`)).status, 403);
  // Owner account can't be self-deleted from the dashboard either.
  assert.equal((await ownerC.post("/api/account/delete", { confirmUsername: "q5" })).status, 403);
});

test("56: permission changes persist and take effect on the next request", async () => {
  const staffRec = (await ownerC.get("/api/admin/staff")).body.staff.find((s: any) => s.discord_id === STAFF_ID);
  assert.equal((await staffC.get("/api/admin/security/events")).status, 403);
  const g = await ownerC.put(`/api/admin/staff/${staffRec.id}/permissions/security.view`, { state: "grant", reason: "incident" });
  assert.ok(g.body.effectivePermissions.includes("security.view"));
  assert.equal((await staffC.get("/api/admin/security/events")).status, 200);
  await ownerC.put(`/api/admin/staff/${staffRec.id}/permissions/support.manage`, { state: "revoke" });
  assert.ok(!(await staffC.get("/api/admin/whoami")).body.permissions.includes("support.manage"));
  // Role defaults are editable too.
  await ownerC.put("/api/admin/permissions/roles/STAFF/users.flag", { enabled: false });
  assert.ok(!(await staffC.get("/api/admin/whoami")).body.permissions.includes("users.flag"));
  const persisted = (await h.app.db.query("SELECT count(*)::int AS n FROM staff_permission_overrides WHERE staff_id = $1", [staffRec.id])).rows[0].n;
  assert.equal(persisted, 2);
});

test("57: suspending or removing staff ends administrative access immediately", async () => {
  const staffRec = (await ownerC.get("/api/admin/staff")).body.staff.find((s: any) => s.discord_id === STAFF_ID);
  await ownerC.patch(`/api/admin/staff/${staffRec.id}`, { active: false, reason: "inactive" });
  assert.equal((await staffC.get("/api/admin/whoami")).status, 403);
  await ownerC.patch(`/api/admin/staff/${staffRec.id}`, { active: true });
  assert.equal((await staffC.get("/api/admin/whoami")).status, 403); // old elevation was revoked
  await staffC.discord(h, STAFF_ID, "modguy", "admin");
  assert.equal((await staffC.get("/api/admin/whoami")).status, 200);
  await ownerC.del(`/api/admin/staff/${staffRec.id}`, { reason: "left team" });
  assert.equal((await staffC.get("/api/admin/whoami")).status, 403);
  assert.equal((await staffC.discord(h, STAFF_ID, "modguy", "admin")).location, "/admin/denied");
});

test("maintenance mode blocks users but not the admin panel or login", async () => {
  await ownerC.put("/api/admin/settings/maintenance.enabled", { value: true });
  const u = new Client(h.base);
  await u.discord(h, RANDO_ID, "rando");
  await u.refreshCsrf();
  assert.equal((await u.get("/api/account/sessions")).body.error.code, "maintenance");
  assert.equal((await ownerC.get("/api/admin/whoami")).status, 200);
  await ownerC.put("/api/admin/settings/maintenance.enabled", { value: false });
  assert.equal((await u.get("/api/account/sessions")).status, 200);
});

test("62/63: sensitive operations are audited; audit rows cannot be altered", async () => {
  const log = (await ownerC.get("/api/admin/audit?limit=500")).body.rows.map((r: any) => r.action);
  for (const a of ["admin.session_started", "staff.added", "staff.permission_changed", "staff.suspended", "staff.removed", "role.permission_changed", "setting.changed"]) {
    assert.ok(log.includes(a), `missing audit action ${a}`);
  }
  const row = (await ownerC.get("/api/admin/audit?action=staff.suspended")).body.rows[0];
  assert.equal(row.reason, "inactive");
  assert.equal(row.actor_role, "OWNER");
  assert.equal(row.actor_discord_id, OWNER_ID);
  await assert.rejects(h.app.db.query("UPDATE admin_audit_log SET reason = 'x'"), /append-only/);
  await assert.rejects(h.app.db.query("DELETE FROM admin_audit_log"), /append-only/);
  await assert.rejects(h.app.db.query("TRUNCATE admin_audit_log"), /append-only/);
  assert.deepEqual((await ownerC.get("/api/admin/audit/verify")).body, { intact: true, firstBrokenId: null });
  // No API can modify audit rows: there is no non-GET audit route at all.
  assert.equal((await ownerC.del("/api/admin/audit")).status, 405);
  const csv = await ownerC.get("/api/admin/audit/export");
  assert.equal(csv.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(csv.body, /^"?id"?,/);
});

test("74: every /api/admin route is permission-guarded (fail-closed registration)", async () => {
  const { Router } = await import("../server/lib/http.ts");
  assert.throws(() => new Router().get("/api/admin/x", () => 1), /without a permission/);
  const { buildRouter } = await import("../server/server.ts");
  for (const r of buildRouter(h.app).list().filter((x) => x.path.startsWith("/api/admin"))) assert.ok(r.perm !== undefined, r.path);
});

test("health endpoint reports honest integration status", async () => {
  const r = await new Client(h.base).get("/api/health");
  assert.equal(r.body.db, "ok");
  assert.match(r.body.integrations.email, /^not_configured/);
  assert.equal(r.body.integrations.discordOAuth, "configured");
});
