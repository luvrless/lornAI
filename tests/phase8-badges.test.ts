/**
 * Admin panel link visibility, the full badge catalogue, donations, gifting,
 * sale-event badges, Server Booster claims and the 1M milestone.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { startHarness, Harness, Client, newUser, ownerClient, staffClient } from "./helpers.ts";
import { closeHashPool } from "../server/lib/password.ts";
import { recheckBoosters } from "../server/modules/badges/booster.ts";
import { previewRecipients } from "../server/modules/events/service.ts";
import { drain } from "../server/modules/jobs/runner.ts";

let h: Harness, owner: Client, admin: Client, staff: Client;
let jay: Awaited<ReturnType<typeof newUser>>, fan: Awaited<ReturnType<typeof newUser>>;
const SECRET = "whsec_test_badges";
const stripeCalls: { path: string; body: string }[] = [];

before(async () => {
  h = await startHarness();
  jay = await newUser(h, "jay");
  fan = await newUser(h, "fan");
  owner = await ownerClient(h);
  admin = await staffClient(h, owner, "222222222222222222", "boss", "ADMIN");
  staff = await staffClient(h, owner, "333333333333333333", "modteam", "STAFF");
  const real = h.app.fetch;
  h.app.fetch = (async (url: any, init: any) => {
    const u = String(url);
    if (!u.startsWith("https://stripe.test/")) return real(url, init);
    const path = u.slice("https://stripe.test/v1/".length);
    stripeCalls.push({ path, body: String(init?.body ?? "") });
    if (path === "checkout/sessions") return new Response(JSON.stringify({ id: `cs_b${stripeCalls.length}`, url: `https://checkout.stripe.test/c/${stripeCalls.length}` }));
    return new Response(JSON.stringify({ error: { message: "unknown" } }), { status: 400 });
  }) as typeof fetch;
});
after(async () => {
  for (const k of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_API_BASE", "DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID"]) delete process.env[k];
  await h.close(); await closeHashPool();
});

const owns = async (userId: string, key: string) =>
  !!(await h.app.db.query("SELECT 1 FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = $1 AND b.key = $2", [userId, key])).rowCount;
const paid = (purchaseId: string, amount: number) => {
  const ev = { id: `evt_${crypto.randomUUID()}`, type: "checkout.session.completed", data: { object: { id: "cs_x", mode: "payment", payment_status: "paid", metadata: { purchase_id: purchaseId }, payment_intent: `pi_${crypto.randomUUID()}`, amount_total: amount, currency: "usd" } } };
  const raw = JSON.stringify(ev), t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", SECRET).update(`${t}.${raw}`).digest("hex");
  return fetch(h.base + "/api/webhooks/stripe", { method: "POST", body: raw, headers: { "stripe-signature": `t=${t},v1=${sig}`, "content-type": "application/json" } });
};
const catalogue = async (c: Client) => new Map(((await c.get("/api/badges/catalogue")).body as any[]).map((b) => [b.key, b]));

test("admin panel link: owner and owner-appointed admins only — never staff or regular users", async () => {
  const meOwner = (await owner.get("/api/auth/me")).body, meAdmin = (await admin.get("/api/auth/me")).body;
  const meStaff = (await staff.get("/api/auth/me")).body, meUser = (await jay.get("/api/auth/me")).body;
  assert.equal(meOwner.adminPanel, true); assert.equal(meOwner.staffRole, "OWNER");
  assert.equal(meAdmin.adminPanel, true); assert.equal(meAdmin.staffRole, "ADMIN");
  assert.equal(meStaff.adminPanel, false); assert.equal(meStaff.staffRole, null, "staff get no hint of the panel");
  assert.equal(meUser.adminPanel, false); assert.equal(meUser.staffRole, null);
  // Only the owner can appoint admins.
  assert.equal((await admin.post("/api/admin/staff", { discordId: "444444444444444444", role: "ADMIN" })).status, 403);
});

test("catalogue lists every badge with honest status and actions", async () => {
  const keys = ["staff", "helper", "premium", "verified", "donor", "og", "gifter", "server_booster", "winner", "second_place", "third_place", "image_host", "bug_hunter", "easter_2027", "christmas_2026", "the_million"];
  const c = await catalogue(jay);
  for (const k of keys) {
    assert.ok(c.has(k), `missing ${k}`);
    assert.ok(c.get(k).description.length > 10, `${k} has a description`);
  }
  assert.equal(c.get("og").owned, true); assert.equal(c.get("og").status, "Unlocked");
  assert.equal(c.get("donor").action, "donate");
  assert.equal(c.get("gifter").action, "gift");
  assert.equal(c.get("server_booster").action, "claim_boost");
  assert.equal(c.get("bug_hunter").action, "report_bug");
  assert.equal(c.get("verified").action, "verified");
  assert.equal(c.get("staff").action, null, "staff can't be requested");
  assert.equal(c.get("image_host").note, "Not available yet");
  assert.equal(c.get("christmas_2026").note, "Available Dec 24, 2026");
  assert.equal(c.get("the_million").note, null);
  // The catalogue never grants anything.
  assert.equal(await owns(jay.userId, "donor"), false);
});

test("donations: $10 minimum, Donor badge only after the verified webhook", async () => {
  assert.equal((await jay.post("/api/billing/checkout", { product: "donation", amountCents: 1500 })).body.error.code, "payments_not_configured");
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_API_BASE: "https://stripe.test" });
  assert.equal((await jay.post("/api/billing/checkout", { product: "donation", amountCents: 999 })).status, 400);
  assert.equal((await jay.post("/api/billing/checkout", { product: "donation", amountCents: 100_001 })).status, 400);
  assert.equal((await jay.post("/api/billing/checkout", { product: "verified", amountCents: 50 })).status, 400, "fixed-price products ignore no custom amount silently");
  const r = await jay.post("/api/billing/checkout", { product: "donation", amountCents: 2500 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(new URLSearchParams(stripeCalls.at(-1)!.body).get("line_items[0][price_data][unit_amount]"), "2500");
  assert.equal(await owns(jay.userId, "donor"), false, "nothing granted from the redirect");
  assert.equal((await paid(r.body.purchaseId, 2500)).status, 200);
  assert.equal(await owns(jay.userId, "donor"), true);
  assert.equal((await catalogue(jay)).get("donor").status, "Donated");
});

test("gifting: recipient gets the product, buyer gets Gifter; self-gifts refused", async () => {
  assert.equal((await jay.post("/api/billing/checkout", { product: "verified", giftTo: "jay" })).status, 400);
  assert.equal((await jay.post("/api/billing/checkout", { product: "verified", giftTo: "nobody_here" })).status, 404);
  assert.equal((await jay.post("/api/billing/checkout", { product: "donation", giftTo: "fan" })).status, 400, "donations aren't giftable");
  const r = await jay.post("/api/billing/checkout", { product: "verified", giftTo: `${fan.uid}` });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.gift, true);
  assert.match(new URLSearchParams(stripeCalls.at(-1)!.body).get("line_items[0][price_data][product_data][name]")!, /gift/);
  await paid(r.body.purchaseId, 999);
  assert.equal(await owns(fan.userId, "verified"), true);
  assert.equal(await owns(jay.userId, "verified"), false);
  assert.equal(await owns(jay.userId, "gifter"), true);
  assert.equal((await fan.get("/api/billing")).body.verified, true);
  assert.ok((await fan.get("/api/account/notifications")).body.some((n: any) => /jay gifted you/.test(n.title)));
  assert.equal((await jay.get("/api/billing")).body.purchases.find((p: any) => p.id === r.body.purchaseId).gift_to, "fan");
  // Can't gift what they already have.
  assert.equal((await jay.post("/api/billing/checkout", { product: "verified", giftTo: "fan" })).status, 409);

  // A gifted Premium is a 30-day one-time payment, not a subscription.
  await owner.put("/api/admin/premium/enabled", { enabled: true });
  const giver = await newUser(h, "giver");
  const p = await giver.post("/api/billing/checkout", { product: "premium", giftTo: "fan" });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(new URLSearchParams(stripeCalls.at(-1)!.body).get("mode"), "payment");
  await paid(p.body.purchaseId, 499);
  const ent = (await h.app.db.query("SELECT expires_at FROM entitlements WHERE user_id = $1 AND kind = 'premium'", [fan.userId])).rows[0];
  const days = (new Date(ent.expires_at).getTime() - Date.now()) / 86400_000;
  assert.ok(days > 29 && days < 31, `gift premium lasts 30 days (got ${days})`);
});

test("sale badges: only users who bought something during the event qualify", async () => {
  const badge = (await h.app.db.query("SELECT id FROM badges WHERE key = 'christmas_2026'")).rows[0].id;
  const ev = (await h.app.db.query("SELECT eligibility FROM badge_events WHERE key = 'christmas_2026'")).rows[0];
  assert.equal(ev.eligibility.requirePurchaseDuringEvent, true);
  // A sale running now: jay bought (donation + gifts), fan only received a gift.
  const e = (await h.app.db.query(
    `INSERT INTO badge_events (key, name, badge_id, starts_at, ends_at, eligibility) VALUES ('test_sale', 'Test sale', $1, now() - interval '1 day', now() + interval '1 day', '{"requirePurchaseDuringEvent": true}') RETURNING id`, [badge])).rows[0];
  const prev = await previewRecipients(h.app, e.id);
  const names = prev.sample.map((u: any) => u.username);
  assert.ok(names.includes("jay") && names.includes("giver"));
  assert.ok(!names.includes("fan"), "receiving a gift isn't a purchase");
  assert.equal(prev.eligible, 2);
});

test("server booster: verified with Discord; removed when the boost ends", async () => {
  assert.equal((await jay.post("/api/badges/server-booster/claim")).body.error.code, "booster_not_configured");
  Object.assign(process.env, { DISCORD_BOT_TOKEN: h.discord.botToken, DISCORD_GUILD_ID: h.discord.guildId });
  assert.equal((await jay.post("/api/badges/server-booster/claim")).body.error.code, "discord_not_linked");
  // A Discord user who isn't in the server, then is but doesn't boost, then boosts.
  const booster = new Client(h.base);
  await booster.discord(h, "555555555555555555", "boosty");
  await booster.post("/api/auth/signup/complete", { username: "boosty", acceptTos: true });
  await booster.refreshCsrf();
  const userId = (await h.app.db.query("SELECT id FROM users WHERE username = 'boosty'")).rows[0].id;
  assert.equal((await booster.post("/api/badges/server-booster/claim")).body.error.code, "not_in_server");
  h.discord.guildMembers.set("555555555555555555", null);
  assert.equal((await booster.post("/api/badges/server-booster/claim")).body.error.code, "not_boosting");
  assert.equal(await owns(userId, "server_booster"), false);
  h.discord.guildMembers.set("555555555555555555", new Date().toISOString());
  const ok = await booster.post("/api/badges/server-booster/claim");
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(await owns(userId, "server_booster"), true);
  assert.equal((await catalogue(booster)).get("server_booster").status, "Boosted");
  // Still boosting → kept. Boost ends → removed and told why.
  assert.deepEqual(await recheckBoosters(h.app), { checked: 1, removed: 0 });
  h.discord.guildMembers.set("555555555555555555", null);
  assert.deepEqual(await recheckBoosters(h.app), { checked: 1, removed: 1 });
  assert.equal(await owns(userId, "server_booster"), false);
  assert.ok((await booster.get("/api/account/notifications")).body.some((n: any) => /Server Booster badge was removed/.test(n.title)));
});

test("The Million: total-reached milestones fire once and badge everyone up to the threshold", async () => {
  const last = Number((await h.app.db.query("SELECT last FROM uid_counter")).rows[0].last);
  await h.app.db.query("UPDATE platform_milestones SET threshold = $1 WHERE key = '1m'", [last + 1]);
  const m = await newUser(h, "millionth");
  await newUser(h, "afterwards");
  assert.equal((await h.app.db.query("SELECT count(*)::int AS n FROM jobs WHERE kind = 'milestone.total' AND payload->>'key' = '1m'")).rows[0].n, 1);
  await drain(h.app);
  assert.equal(await owns(m.userId, "the_million"), true);
  assert.equal(await owns(jay.userId, "the_million"), true);
  const after = (await h.app.db.query("SELECT id FROM users WHERE username = 'afterwards'")).rows[0].id;
  assert.equal(await owns(after, "the_million"), false);
  assert.equal((await catalogue(jay)).get("the_million").note, null, "owned badges show their status, not a note");
});

test("staff hand out event placements; regular users can't", async () => {
  const winner = (await h.app.db.query("SELECT id FROM badges WHERE key = 'winner'")).rows[0].id;
  assert.equal((await jay.post(`/api/admin/users/${fan.userId}/badges`, { badgeId: winner })).status, 403);
  const r = await admin.post(`/api/admin/users/${fan.userId}/badges`, { badgeId: winner, reason: "Won the launch event" });
  assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
  assert.equal(await owns(fan.userId, "winner"), true);
});
