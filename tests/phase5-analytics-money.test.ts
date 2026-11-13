/** Analytics (real events, bots filtered) and acceptance 64–69 (monetization). */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { startHarness, Harness, Client, newUser, ownerClient, staffClient } from "./helpers.ts";
import { closeHashPool } from "../server/lib/password.ts";

let h: Harness, owner: Client, admin: Client;
let jay: Awaited<ReturnType<typeof newUser>>, fan: Awaited<ReturnType<typeof newUser>>;
const SECRET = "whsec_test_123";
const stripeCalls: { path: string; body: string }[] = [];

before(async () => {
  h = await startHarness();
  jay = await newUser(h, "jay");
  fan = await newUser(h, "fan");
  owner = await ownerClient(h);
  admin = await staffClient(h, owner, "222222222222222222", "boss", "ADMIN");
  const e = (await jay.get("/api/profile/editor")).body;
  e.draft.links = [{ id: "lnkgithub1", platform: "github", url: "https://github.com/luvrless" }];
  e.draft.music = { ...e.draft.music, tracks: [] };
  await jay.put("/api/profile/draft", { config: e.draft, rev: e.rev });
  await jay.post("/api/profile/publish");
  const real = h.app.fetch;
  h.app.fetch = (async (url: any, init: any) => {
    const u = String(url);
    if (!u.startsWith("https://stripe.test/")) return real(url, init);
    const path = u.slice("https://stripe.test/v1/".length);
    stripeCalls.push({ path, body: String(init?.body ?? "") });
    if (path === "checkout/sessions") return new Response(JSON.stringify({ id: `cs_${stripeCalls.length}`, url: `https://checkout.stripe.test/c/${stripeCalls.length}` }));
    if (path === "refunds") return new Response(JSON.stringify({ id: `re_${stripeCalls.length}`, amount: 999, status: "pending" }));
    return new Response(JSON.stringify({ error: { message: "unknown" } }), { status: 400 });
  }) as typeof fetch;
});
after(async () => { await h.close(); await closeHashPool(); });

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("views: real browsers counted once per visit; bots and the owner are not", async () => {
  const v1 = new Client(h.base, "203.0.113.1", CHROME);
  assert.deepEqual((await v1.post("/api/p/jay/view", { referrer: "https://x.com/q5/status/1", utm: { source: "x", campaign: "launch" } })).body, { recorded: true });
  assert.deepEqual((await v1.post("/api/p/jay/view", {})).body, { recorded: false, reason: "duplicate" });
  assert.equal((await new Client(h.base, "203.0.113.2", IPHONE).post("/api/p/jay/view", {})).body.recorded, true);
  assert.equal((await new Client(h.base, "203.0.113.3", "Discordbot/2.0 (+https://discordapp.com)").post("/api/p/jay/view", {})).body.reason, "bot");
  assert.equal((await new Client(h.base, "203.0.113.4", "curl/8.0").post("/api/p/jay/view", {})).body.reason, "bot");
  assert.equal((await jay.post("/api/p/jay/view", {})).body.reason, "owner");
  // No raw IP is stored anywhere in analytics.
  const raw = JSON.stringify((await h.app.db.query("SELECT * FROM analytics_events")).rows);
  assert.ok(!raw.includes("203.0.113"));
});

test("clicks: only real links, deduplicated briefly; CTR computed", async () => {
  const v = new Client(h.base, "203.0.113.1", CHROME);
  assert.equal((await v.post("/api/p/jay/click", { linkId: "nope" })).status, 404);
  assert.equal((await v.post("/api/p/jay/click", { linkId: "lnkgithub1" })).body.recorded, true);
  assert.equal((await v.post("/api/p/jay/click", { linkId: "lnkgithub1" })).body.recorded, false);
  const s = (await jay.get("/api/analytics")).body;
  assert.equal(s.totals.views, 2);
  assert.equal(s.totals.uniques, 2);
  assert.equal(s.totals.clicks, 1);
  assert.equal(s.totals.ctr, 0.5);
  assert.deepEqual(s.links[0], { link_id: "lnkgithub1", clicks: 1, uniques: 1, ctr: 0.5 });
  assert.deepEqual(s.referrers.map((r: any) => r.name).sort(), ["direct", "x.com"]);
  assert.deepEqual(s.devices.map((d: any) => d.name).sort(), ["desktop", "mobile"]);
  assert.equal(s.campaigns[0].campaign, "launch");
  assert.equal(s.allTime, 2);
  assert.equal(s.series.length, 31);
  const csv = await jay.get("/api/analytics/export");
  assert.equal(csv.body.split("\n").length, 4);
  // Users only ever see their own analytics.
  assert.equal((await fan.get("/api/analytics")).body.totals.views, 0);
});

// ------------------------------------------------------------------ money

function signed(event: object, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(event);
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return { raw, header: `t=${t},v1=${sig}` };
}
const hook = (e: object, secret?: string, t?: number) => {
  const s = signed(e, secret, t);
  return fetch(h.base + "/api/webhooks/stripe", { method: "POST", body: s.raw, headers: { "stripe-signature": s.header, "content-type": "application/json" } });
};

test("payments report 'not configured' honestly until keys are set", async () => {
  const b = (await jay.get("/api/billing")).body;
  assert.match(b.provider, /^not_configured/);
  assert.equal(b.products.find((p: any) => p.key === "badge_pack").unavailableReason, "Payments aren't set up yet");
  process.env.STRIPE_SECRET_KEY = "sk_test_x"; process.env.STRIPE_WEBHOOK_SECRET = SECRET; process.env.STRIPE_API_BASE = "https://stripe.test";
});

test("64: Premium is off by default; the owner's global switch controls purchasing", async () => {
  assert.equal((await jay.post("/api/billing/checkout", { product: "premium" })).body.error.code, "premium_disabled");
  assert.equal((await admin.put("/api/admin/premium/enabled", { enabled: true })).status, 403);
  assert.equal((await owner.put("/api/admin/premium/enabled", { enabled: true })).status, 200);
  const r = await jay.post("/api/billing/checkout", { product: "premium" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.url, /^https:\/\/checkout\.stripe\.test/);
  const sent = new URLSearchParams(stripeCalls.at(-1)!.body);
  assert.equal(sent.get("mode"), "subscription");
  assert.equal(sent.get("line_items[0][price_data][unit_amount]"), "499");
});

test("65: product configuration persists and is used at checkout", async () => {
  assert.equal((await admin.patch("/api/admin/products/verified", { priceCents: 1299 })).status, 403);
  const u = await owner.patch("/api/admin/products/verified", { priceCents: 1299 });
  assert.equal(u.body.price_cents, 1299);
  await fan.post("/api/billing/checkout", { product: "verified" });
  assert.equal(new URLSearchParams(stripeCalls.at(-1)!.body).get("line_items[0][price_data][unit_amount]"), "1299");
  assert.equal((await owner.get("/api/admin/audit?action=product.updated")).body.rows[0].new_state.price, 1299);
});

test("67: webhooks are signature-verified; a browser redirect grants nothing", async () => {
  const purchase = (await h.app.db.query("SELECT id FROM purchases WHERE user_id = $1 AND product_key = 'premium'", [jay.userId])).rows[0].id;
  // Visiting the success URL does nothing by itself.
  await jay.get("/dashboard/premium?checkout=success");
  assert.equal((await jay.get("/api/billing")).body.premium, false);
  const ev = { id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", mode: "subscription", subscription: "sub_1", payment_status: "paid", client_reference_id: purchase, metadata: { purchase_id: purchase }, amount_total: 499, currency: "usd", payment_intent: null, invoice: "in_1" } } };
  assert.equal((await hook(ev, "whsec_wrong")).status, 400);
  assert.equal((await hook(ev, SECRET, Math.floor(Date.now() / 1000) - 3600)).status, 400); // replayed/stale
  assert.equal((await fetch(h.base + "/api/webhooks/stripe", { method: "POST", body: JSON.stringify(ev) })).status, 400);
  assert.equal((await jay.get("/api/billing")).body.premium, false);
  assert.equal((await hook(ev)).status, 200);
  const b = (await jay.get("/api/billing")).body;
  assert.equal(b.premium, true);
  assert.equal(b.subscription.status, "active");
  assert.ok((await new Client(h.base).get("/api/p/jay")).body.badges.some((x: any) => x.key === "premium"));
});

test("68: duplicate payment events never create duplicate entitlements", async () => {
  const purchase = (await h.app.db.query("SELECT id FROM purchases WHERE user_id = $1 AND product_key = 'premium'", [jay.userId])).rows[0].id;
  const ev = { id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", mode: "subscription", subscription: "sub_1", payment_status: "paid", metadata: { purchase_id: purchase }, amount_total: 499, currency: "usd" } } };
  assert.deepEqual(await (await hook(ev)).json(), { duplicate: true });
  await hook({ ...ev, id: "evt_1_redelivered_differently" }); // same purchase, new event id
  const n = (await h.app.db.query("SELECT count(*)::int AS n FROM entitlements WHERE user_id = $1 AND kind = 'premium'", [jay.userId])).rows[0].n;
  assert.equal(n, 1);
  // Renewal extends the same entitlement.
  const end = Math.floor(Date.now() / 1000) + 60 * 86400;
  await hook({ id: "evt_inv2", type: "invoice.paid", data: { object: { id: "in_2", subscription: "sub_1", amount_paid: 499, currency: "usd", lines: { data: [{ period: { end } }] } } } });
  const exp = (await h.app.db.query("SELECT expires_at FROM entitlements WHERE user_id = $1 AND kind = 'premium'", [jay.userId])).rows[0].expires_at;
  assert.ok(new Date(exp).getTime() > Date.now() + 59 * 86400_000);
});

test("66: purchased Verified is distinguishable from admin-granted Verified; badge pack adds 3 credits", async () => {
  const p = (await h.app.db.query("SELECT id FROM purchases WHERE user_id = $1 AND product_key = 'verified'", [fan.userId])).rows[0].id;
  await hook({ id: "evt_v", type: "checkout.session.completed", data: { object: { id: "cs_v", mode: "payment", payment_status: "paid", metadata: { purchase_id: p }, amount_total: 1299, currency: "usd", payment_intent: "pi_v" } } });
  const other = await newUser(h, "granted");
  await owner.post(`/api/admin/users/${other.userId}/verified`, { reason: "notable creator" });
  const rows = (await owner.get("/api/admin/verified-users")).body;
  assert.equal(rows.find((r: any) => r.username === "fan").source, "purchase");
  const g = rows.find((r: any) => r.username === "granted");
  assert.deepEqual([g.source, g.granted_by, g.reason], ["admin_grant", "q5", "notable creator"]);
  const methods = (await h.app.db.query("SELECT u.username, ub.method FROM user_badges ub JOIN badges b ON b.id = ub.badge_id JOIN users u ON u.id = ub.user_id WHERE b.key = 'verified' ORDER BY u.username")).rows;
  assert.deepEqual(methods, [{ username: "fan", method: "purchase" }, { username: "granted", method: "admin_grant" }]);

  await fan.post("/api/billing/checkout", { product: "badge_pack" });
  const bp = (await h.app.db.query("SELECT id FROM purchases WHERE user_id = $1 AND product_key = 'badge_pack'", [fan.userId])).rows[0].id;
  await hook({ id: "evt_bp", type: "checkout.session.completed", data: { object: { id: "cs_bp", mode: "payment", payment_status: "paid", metadata: { purchase_id: bp }, amount_total: 299, currency: "usd", payment_intent: "pi_bp" } } });
  await hook({ id: "evt_bp_again", type: "checkout.session.completed", data: { object: { id: "cs_bp", mode: "payment", payment_status: "paid", metadata: { purchase_id: bp }, amount_total: 299, currency: "usd", payment_intent: "pi_bp" } } });
  assert.equal((await fan.get("/api/badges/me")).body.credits, 3);
});

test("69: refunds — admin request goes to the provider; the webhook records it and revokes", async () => {
  const p = (await h.app.db.query("SELECT id FROM purchases WHERE user_id = $1 AND product_key = 'verified'", [fan.userId])).rows[0].id;
  assert.equal((await admin.post(`/api/admin/purchases/${p}/refund`, { reason: "requested" })).status, 403); // no payments.refund by default
  const r = await owner.post(`/api/admin/purchases/${p}/refund`, { reason: "customer request" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(new URLSearchParams(stripeCalls.at(-1)!.body).get("payment_intent"), "pi_v");
  await hook({ id: "evt_ref", type: "charge.refunded", data: { object: { id: "ch_v", amount: 1299, amount_refunded: 1299, metadata: { purchase_id: p }, refunds: { data: [{ id: "re_final", amount: 1299 }] } } } });
  const refunds = (await owner.get("/api/admin/refunds")).body;
  assert.ok(refunds.some((x: any) => x.provider_refund_id === "re_final"));
  assert.equal((await fan.get("/api/billing")).body.verified, false);
  assert.equal((await h.app.db.query("SELECT status FROM purchases WHERE id = $1", [p])).rows[0].status, "refunded");
  assert.ok((await owner.get("/api/admin/audit?action=payment.refunded")).body.rows.length === 1);
});

test("disabling Premium keeps existing entitlements and admin management", async () => {
  await owner.put("/api/admin/premium/enabled", { enabled: false });
  assert.equal((await jay.get("/api/billing")).body.premium, true);
  assert.equal((await fan.post("/api/billing/checkout", { product: "premium" })).body.error.code, "premium_disabled");
  assert.equal((await owner.post(`/api/admin/users/${fan.userId}/premium`, { expiresAt: null, reason: "gift" })).status, 204);
  assert.equal((await fan.get("/api/billing")).body.premium, true);
  assert.equal((await owner.del(`/api/admin/users/${fan.userId}/premium`, { reason: "gift ended" })).status, 204);
  assert.equal((await fan.get("/api/billing")).body.premium, false);
});

test("subscription cancellation and failed payments are recorded", async () => {
  await hook({ id: "evt_fail", type: "invoice.payment_failed", data: { object: { id: "in_fail", subscription: "sub_1", amount_due: 499, currency: "usd" } } });
  assert.equal((await owner.get("/api/admin/subscriptions")).body[0].status, "past_due");
  await hook({ id: "evt_del", type: "customer.subscription.deleted", data: { object: { id: "sub_1", status: "canceled" } } });
  assert.equal((await jay.get("/api/billing")).body.premium, false);
  const dash = (await owner.get("/api/admin/dashboard")).body.monetization;
  assert.equal(dash.failed_payments, 1);
  assert.ok(dash.revenue_cents >= 499 + 1299 + 299);
});
