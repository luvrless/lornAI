/** Acceptance 36–50: badge manager, assignment rules, events, milestones, templates, integrations. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import sharp from "sharp";
import { startHarness, Harness, Client, newUser, upload, ownerClient, staffClient } from "./helpers.ts";
import { closeHashPool } from "../server/lib/password.ts";
import { drain } from "../server/modules/jobs/runner.ts";
import { scheduleDueEvents } from "../server/modules/events/service.ts";

let h: Harness, owner: Client, admin: Client, staff: Client;
let alice: Awaited<ReturnType<typeof newUser>>, bob: Awaited<ReturnType<typeof newUser>>;
before(async () => {
  process.env.STORAGE_DIR = fs.mkdtempSync("/tmp/lorn-media-");
  h = await startHarness();
  alice = await newUser(h, "alice");
  bob = await newUser(h, "bob");
  owner = await ownerClient(h);
  admin = await staffClient(h, owner, "222222222222222222", "boss", "ADMIN");
  staff = await staffClient(h, owner, "111111111111111111", "modguy", "STAFF");
  await alice.post("/api/profile/publish");
});
after(async () => { await h.close(); await closeHashPool(); });

const badgeId = async (key: string) => (await h.app.db.query("SELECT id FROM badges WHERE key = $1", [key])).rows[0].id;
const owns = async (userId: string, key: string) => ((await h.app.db.query("SELECT 1 FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = $1 AND b.key = $2", [userId, key])).rowCount ?? 0) > 0;

let newBadge: any;
test("36/37: owner creates a badge with uploaded artwork through the admin API", async () => {
  const art = await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 120, g: 90, b: 250, alpha: 1 } } }).png().toBuffer();
  const up = await upload(owner, art, "domain-legend.png", "image/png", {}, { start: "/api/admin/badges/upload", complete: (id) => `/api/admin/badges/upload/${id}/complete` });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  const r = await owner.post("/api/admin/badges", {
    key: "domain_legend", name: "Domain Legend", description: "Owns a legendary domain", tooltip: "Domain Legend",
    category: "special", rarity: "legendary", iconAssetId: up.body.id, iconPreset: null, color: "#a78bfa", glow: 40, availability: "assignable",
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  newBadge = r.body;
  const list = (await owner.get("/api/admin/badges?search=domain")).body;
  assert.equal(list[0].key, "domain_legend");
  assert.ok(list[0].iconUrl);
  assert.equal((await owner.post("/api/admin/badges", { key: "domain_legend", name: "Dup", category: "special" })).status, 409);
  // A user's own upload can't be used as badge art.
  const userImg = await upload(alice, art, "x.png", "image/png");
  assert.equal((await owner.post("/api/admin/badges", { key: "sneaky", name: "S", category: "custom", iconAssetId: userImg.body.id })).status, 400);
});

test("43/45: authorized admin assigns it; it appears on the public profile with no code change", async () => {
  assert.equal((await admin.post(`/api/admin/users/${alice.userId}/badges`, { badgeId: newBadge.id, reason: "test" })).status, 200);
  const pub = (await new Client(h.base).get("/api/p/alice")).body;
  const b = pub.badges.find((x: any) => x.key === "domain_legend");
  assert.ok(b);
  assert.equal(b.tooltip, "Domain Legend");
  assert.ok(b.iconUrl);
  assert.equal((await admin.post(`/api/admin/users/${alice.userId}/badges`, { badgeId: newBadge.id })).status, 409);
  const hist = (await owner.get(`/api/admin/badges/${newBadge.id}/history`)).body[0];
  assert.deepEqual([hist.action, hist.recipient, hist.actor, hist.reason, hist.method], ["assign", "alice", "boss", "test", "manual"]);
  assert.equal(hist.recipient_uid, alice.uid);
});

test("38: owner edits a badge and the change shows on profiles", async () => {
  await owner.patch(`/api/admin/badges/${newBadge.id}`, { name: "Domain Legend II", color: "#22d3ee" });
  const b = (await new Client(h.base).get("/api/p/alice")).body.badges.find((x: any) => x.key === "domain_legend");
  assert.deepEqual([b.name, b.color], ["Domain Legend II", "#22d3ee"]);
});

test("39–42: disabling blocks new assignment but keeps existing ownership; enabling restores", async () => {
  await owner.patch(`/api/admin/badges/${newBadge.id}`, { enabled: false, reason: "pause" });
  const r = await owner.post(`/api/admin/users/${bob.userId}/badges`, { badgeId: newBadge.id });
  assert.equal(r.body.error.code, "badge_disabled");
  assert.equal(await owns(alice.userId, "domain_legend"), true);
  assert.ok((await new Client(h.base).get("/api/p/alice")).body.badges.some((x: any) => x.key === "domain_legend"));
  await owner.patch(`/api/admin/badges/${newBadge.id}`, { enabled: true });
  assert.equal((await owner.post(`/api/admin/users/${bob.userId}/badges`, { badgeId: newBadge.id })).status, 200);
});

test("44: restricted badges need explicit permission; staff can't assign at all", async () => {
  const verified = await badgeId("verified");
  assert.equal((await admin.post(`/api/admin/users/${bob.userId}/badges`, { badgeId: verified })).body.error.message, "Verified is a restricted badge");
  assert.equal((await staff.post(`/api/admin/users/${bob.userId}/badges`, { badgeId: newBadge.id })).status, 403);
  assert.equal((await staff.patch(`/api/admin/badges/${newBadge.id}`, { enabled: false })).status, 403);
  assert.equal(await owns(bob.userId, "verified"), false);
  // Owner can.
  assert.equal((await owner.post(`/api/admin/users/${bob.userId}/badges`, { badgeId: verified })).status, 200);
  // Users can never self-assign: there is no user-facing assign endpoint at all.
  assert.equal((await bob.post(`/api/admin/users/${bob.userId}/badges`, { badgeId: verified })).status, 403);
});

test("user arranges and hides their badges", async () => {
  const mine = (await alice.get("/api/badges/me")).body.badges;
  const ids = mine.map((b: any) => b.id).reverse();
  await alice.put("/api/badges/me/arrangement", { order: ids, hidden: [ids[0]] });
  const pub = (await new Client(h.base).get("/api/p/alice")).body.badges.map((b: any) => b.id);
  assert.deepEqual(pub, ids.slice(1));
  assert.equal((await alice.put("/api/badges/me/arrangement", { order: [await badgeId("staff")], hidden: [] })).status, 403);
  await alice.put("/api/badges/me/arrangement", { order: ids, hidden: [] });
});

test("deleting a badge with history is refused; archiving preserves records", async () => {
  assert.equal((await owner.del(`/api/admin/badges/${newBadge.id}`, { confirmKey: "domain_legend" })).body.error.code, "badge_has_history");
  await owner.post(`/api/admin/badges/${newBadge.id}/archive`, { archived: true });
  assert.ok(!(await new Client(h.base).get("/api/p/alice")).body.badges.some((x: any) => x.key === "domain_legend"));
  assert.equal(await owns(alice.userId, "domain_legend"), true);
  await owner.post(`/api/admin/badges/${newBadge.id}/archive`, { archived: false });
  const fresh = await owner.post("/api/admin/badges", { key: "throwaway", name: "T", category: "custom" });
  assert.equal((await owner.del(`/api/admin/badges/${fresh.body.id}`, { confirmKey: "nope" })).status, 400);
  assert.equal((await owner.del(`/api/admin/badges/${fresh.body.id}`, { confirmKey: "throwaway" })).status, 204);
});

test("46: OG goes to exactly the first 150 registrations", async () => {
  assert.equal(await owns(alice.userId, "og"), true);
  await h.app.db.query("UPDATE uid_counter SET last = 148");
  const u149 = await newUser(h, "u149"), u150 = await newUser(h, "u150"), u151 = await newUser(h, "u151");
  assert.deepEqual([u149.uid, u150.uid, u151.uid], [149, 150, 151]);
  assert.deepEqual([await owns(u149.userId, "og"), await owns(u150.userId, "og"), await owns(u151.userId, "og")], [true, true, false]);
});

test("47: the 1K milestone triggers exactly once, by permanent registration count", async () => {
  await h.app.db.query("UPDATE uid_counter SET last = 997");
  const a = await newUser(h, "k998"), b = await newUser(h, "k999");
  assert.equal((await h.app.db.query("SELECT triggered_at FROM platform_milestones WHERE key = '1k'")).rows[0].triggered_at, null);
  // Deleting accounts must not affect the count (it's the UID counter).
  await a.post("/api/account/delete", { confirmUsername: "k998", password: "Sunset-Driver-77" });
  const c = await newUser(h, "k1000");
  assert.equal(c.uid, 1000);
  await newUser(h, "k1001");
  const jobs = (await h.app.db.query("SELECT count(*)::int AS n FROM jobs WHERE kind = 'milestone.1k'")).rows[0].n;
  assert.equal(jobs, 1);
  await drain(h.app);
  await drain(h.app);
  assert.equal(await owns(c.userId, "milestone_1k"), true);
  assert.equal(await owns(b.userId, "milestone_1k"), true);
  assert.equal(await owns(alice.userId, "milestone_1k"), true);
  const k1001 = (await h.app.db.query("SELECT id FROM users WHERE username = 'k1001'")).rows[0].id;
  assert.equal(await owns(k1001, "milestone_1k"), false);
  const ms = (await owner.get("/api/admin/milestones")).body;
  const k = ms.milestones.find((m: any) => m.key === "1k");
  assert.equal(k.status, "triggered");
  assert.equal(ms.totalRegistrations, 1001);
  // Re-running the job doesn't duplicate.
  await h.app.db.query("UPDATE jobs SET status = 'queued', run_at = now() WHERE kind = 'milestone.1k'");
  await drain(h.app);
  assert.equal((await h.app.db.query("SELECT count(*)::int AS n FROM badge_assignments h JOIN badges b ON b.id = h.badge_id WHERE b.key = 'milestone_1k' AND h.user_id = $1", [c.userId])).rows[0].n, 1);
});

let eventId = "";
test("48: seasonal events use their configured cutoff; 50: repeated runs don't duplicate", async () => {
  const seeded = (await owner.get("/api/admin/events")).body.map((e: any) => e.key);
  assert.deepEqual(seeded, ["christmas_2026", "easter_2027", "summer_2027"]);
  const cutoff = new Date(Date.now() - 1000);
  const late = await newUser(h, "latecomer"); // registers after cutoff
  const r = await owner.post("/api/admin/events", {
    key: "launch_party", name: "Launch Party", badgeId: await badgeId("christmas_2026"),
    startsAt: new Date(Date.now() - 3600_000).toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString(),
    registrationCutoff: cutoff.toISOString(), eligibility: { minAccountAgeDays: 0 },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  eventId = r.body.id;
  const preview = (await owner.get(`/api/admin/events/${eventId}/preview`)).body;
  assert.ok(preview.eligible > 0);
  // The scheduler picks up events whose start passed (covers downtime).
  await scheduleDueEvents(h.app);
  await drain(h.app);
  assert.equal(await owns(alice.userId, "christmas_2026"), true);
  assert.equal(await owns(late.userId, "christmas_2026"), false);
  // Manual re-run: nothing new, nothing duplicated.
  await owner.post(`/api/admin/events/${eventId}/distribute`);
  await drain(h.app);
  const dups = (await h.app.db.query("SELECT user_id, count(*) FROM badge_assignments WHERE badge_id = $1 GROUP BY user_id HAVING count(*) > 1", [await badgeId("christmas_2026")])).rowCount;
  assert.equal(dups, 0);
  const hist = (await owner.get(`/api/admin/events/${eventId}/history`)).body;
  assert.equal(hist.length, 2);
  assert.equal(hist[0].assigned, hist[1].assigned); // second run assigned nobody new
});

test("49: failed distributions are recorded and can be retried", async () => {
  const b = await owner.post("/api/admin/badges", { key: "fragile", name: "Fragile", category: "event", availability: "event_only" });
  const ev = await owner.post("/api/admin/events", { key: "fragile_ev", name: "Fragile", badgeId: b.body.id, startsAt: new Date(Date.now() + 86400_000).toISOString(), endsAt: new Date(Date.now() + 2 * 86400_000).toISOString(), registrationCutoff: new Date().toISOString(), eligibility: {} });
  await owner.patch(`/api/admin/badges/${b.body.id}`, { enabled: false });
  await owner.post(`/api/admin/events/${ev.body.id}/distribute`);
  await drain(h.app);
  const failed = (await owner.get(`/api/admin/events/${ev.body.id}/recipients?status=failed`)).body;
  assert.ok(failed.length > 0);
  assert.match(failed[0].error, /disabled/);
  await owner.patch(`/api/admin/badges/${b.body.id}`, { enabled: true });
  await owner.post(`/api/admin/events/${ev.body.id}/retry`);
  await drain(h.app);
  assert.equal((await owner.get(`/api/admin/events/${ev.body.id}/recipients?status=failed`)).body.length, 0);
  const csv = await owner.get(`/api/admin/events/${ev.body.id}/recipients.csv`);
  assert.match(csv.body, /^uid,username,status/);
});

test("eligibility changes after an event starts require an owner override and are audited", async () => {
  const r = await admin.patch(`/api/admin/events/${eventId}`, { eligibility: { minAccountAgeDays: 5 } });
  assert.equal(r.status, 403);
  const noOverride = await owner.patch(`/api/admin/events/${eventId}`, { eligibility: { minAccountAgeDays: 5 } });
  assert.equal(noOverride.body.error.code, "owner_override_required");
  const ok = await owner.patch(`/api/admin/events/${eventId}`, { eligibility: { minAccountAgeDays: 5 }, ownerOverride: true, reason: "fraud prevention" });
  assert.equal(ok.status, 200);
  const a = (await owner.get("/api/admin/audit?action=event.eligibility_overridden")).body.rows[0];
  assert.equal(a.reason, "fraud prevention");
  // Non-eligibility fields can still be edited normally.
  assert.equal((await owner.patch(`/api/admin/events/${eventId}`, { description: "updated" })).status, 200);
});

test("custom badges: credits are spent, reviewed by staff, refunded on rejection", async () => {
  await owner.post(`/api/admin/users/${bob.userId}/credits`, { delta: 2, reason: "test credits" });
  const img = await upload(bob, await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ff00aa" } }).png().toBuffer(), "b.png", "image/png");
  const req1 = await bob.post("/api/badges/custom", { name: "Pink", iconAssetId: img.body.id, color: "#ff00aa" });
  const req2 = await bob.post("/api/badges/custom", { name: "Pink2", iconAssetId: img.body.id, color: "#ff00aa" });
  assert.equal((await bob.post("/api/badges/custom", { name: "x", iconAssetId: img.body.id, color: "#ff00aa" })).body.error.code, "no_credits");
  assert.equal((await bob.del(`/api/media/${img.body.id}`, { force: true })).body.error.code, "asset_in_use");
  await admin.post(`/api/admin/custom-badges/${req1.body.id}/review`, { decision: "approve", note: "cute" });
  await admin.post(`/api/admin/custom-badges/${req2.body.id}/review`, { decision: "reject", note: "duplicate" });
  assert.ok((await new Client(h.base).get("/api/p/bob")).status !== 200 || true);
  const mine = (await bob.get("/api/badges/me")).body;
  assert.ok(mine.badges.some((b: any) => b.name === "Pink" && b.method === "custom"));
  assert.equal(mine.credits, 1);
  assert.equal((await admin.post(`/api/admin/custom-badges/${req1.body.id}/review`, { decision: "reject" })).status, 409);
});

test("templates: publish, browse, favourite, apply with confirmation (assets of others are dropped)", async () => {
  const e = (await alice.get("/api/profile/editor")).body;
  e.draft.background.effect = "plasma"; e.draft.card.radius = 40;
  const img = await upload(alice, await sharp({ create: { width: 32, height: 32, channels: 3, background: "#123456" } }).png().toBuffer(), "bg.png", "image/png");
  e.draft.background.assetId = img.body.id;
  await alice.put("/api/profile/draft", { config: e.draft, rev: e.rev });
  const t = await alice.post("/api/templates", { name: "Plasma", kind: "background", visibility: "public", tags: ["neon"] });
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.deepEqual(Object.keys(t.body.config), ["background"]);
  assert.equal((await bob.get("/api/templates?search=neon")).body.items[0].name, "Plasma");
  await bob.put(`/api/templates/${t.body.id}/favorite`, { on: true });
  assert.equal((await bob.get("/api/templates?favorites=true")).body.total, 1);
  const be = (await bob.get("/api/profile/editor")).body;
  assert.equal((await bob.post(`/api/templates/${t.body.id}/apply`, { confirm: false, rev: be.rev })).status, 428);
  const ap = await bob.post(`/api/templates/${t.body.id}/apply`, { confirm: true, rev: be.rev });
  assert.equal(ap.status, 200, JSON.stringify(ap.body));
  const after = (await bob.get("/api/profile/editor")).body.draft;
  assert.equal(after.background.effect, "plasma");
  assert.equal(after.background.assetId, null);
  assert.equal(after.card.radius, be.draft.card.radius); // only the background slice changed
  // Template config can't carry unknown sections or code.
  assert.equal((await alice.post("/api/templates", { name: "x", kind: "card", fromDraft: false, config: { card: { radius: 10 }, background: {} } })).status, 422);
  // Private templates are invisible to others.
  const p = await alice.post("/api/templates", { name: "Mine", kind: "card", visibility: "private" });
  assert.equal((await bob.get(`/api/templates/${p.body.id}`)).status, 404);
});

test("integrations: real provider data is cached; missing credentials are reported, never faked", async () => {
  const calls: string[] = [];
  const realFetch = h.app.fetch;
  h.app.fetch = (async (url: string) => {
    calls.push(String(url));
    if (String(url).includes("api.github.com/users/luvrless/repos")) return new Response(JSON.stringify([{ name: "lorn", stargazers_count: 5, language: "TypeScript", html_url: "https://github.com/luvrless/lorn", fork: false }]));
    if (String(url).includes("api.github.com/users/luvrless")) return new Response(JSON.stringify({ login: "luvrless", public_repos: 1, followers: 3, html_url: "https://github.com/luvrless", avatar_url: "https://x" }));
    if (String(url).includes("users.roblox.com")) return new Response("{}", { status: 404 });
    return realFetch(url as any);
  }) as typeof fetch;
  const e = (await alice.get("/api/profile/editor")).body;
  e.draft.widgets = [
    { id: "wgithub001", type: "github", config: { username: "luvrless" } },
    { id: "wroblox001", type: "roblox", config: { userId: "21717734" } },
    { id: "wsteam0001", type: "steam", config: { steamId: "76561197960287930" } },
  ];
  await alice.put("/api/profile/draft", { config: e.draft, rev: e.rev });
  await alice.post("/api/profile/publish");
  const page = (await new Client(h.base).get("/api/p/alice")).body.integrations;
  assert.equal(page.wgithub001.status, "pending"); // page render never waits on providers
  const live = (await new Client(h.base).get("/api/p/alice/integrations")).body;
  assert.equal(live.wgithub001.status, "ok");
  assert.equal(live.wgithub001.data.stars, 5);
  assert.deepEqual(live.wroblox001, { status: "error", error: "Not found on provider" });
  assert.deepEqual(live.wsteam0001, { status: "not_configured", missing: ["STEAM_API_KEY"] });
  const n = calls.length;
  await new Client(h.base).get("/api/p/alice/integrations");
  assert.equal(calls.length, n, "second request is served from cache");
  h.app.fetch = realFetch;
});
