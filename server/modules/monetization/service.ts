/**
 * Products, checkout, webhooks, entitlements and refunds.
 *
 * Entitlements are granted ONLY from verified provider webhooks (or by an
 * authorized admin), never from a browser redirect. Webhooks are signature-
 * checked and deduplicated by event ID; fulfilment is idempotent per purchase.
 * The provider is Stripe (configure STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET).
 */
import crypto from "node:crypto";
import type { App, Queryable } from "../../app.ts";
import type { Ctx } from "../../lib/http.ts";
import { asJson } from "../../db/pg.ts";
import { HttpError, badRequest, conflict, notFound, unavailable } from "../../lib/errors.ts";
import { audit, getSetting, notify } from "../platform/service.ts";
import { actorOf } from "../authz/service.ts";
import { assignBadge, addCredits } from "../badges/service.ts";
import { hasEntitlement } from "./entitlements.ts";

const stripe = () => {
  const key = process.env.STRIPE_SECRET_KEY, wh = process.env.STRIPE_WEBHOOK_SECRET;
  return key && wh ? { key, webhookSecret: wh, api: process.env.STRIPE_API_BASE ?? "https://api.stripe.com" } : null;
};
export const paymentStatus = () => stripe() ? "configured (Stripe)" : "not_configured: set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET";

async function stripeCall(app: App, path: string, form: Record<string, string>, idem?: string) {
  const s = stripe();
  if (!s) throw unavailable("Payments are not configured on this server", "payments_not_configured");
  const r = await app.fetch(`${s.api}/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.key}`, "Content-Type": "application/x-www-form-urlencoded", ...(idem ? { "Idempotency-Key": idem } : {}) },
    body: new URLSearchParams(form), signal: AbortSignal.timeout(15_000),
  });
  const j = await r.json() as any;
  if (!r.ok) throw new HttpError(502, "payment_provider_error", j?.error?.message ?? `Stripe error ${r.status}`);
  return j;
}

export async function listProducts(app: App) {
  return {
    premiumEnabled: await getSetting<boolean>(app, "premium.enabled", false),
    provider: paymentStatus(),
    products: (await app.db.query("SELECT key, name, description, price_cents, currency, billing, enabled, grants, updated_at FROM products ORDER BY price_cents")).rows,
  };
}

export async function updateProduct(app: App, c: Ctx, key: string, p: { name?: string; description?: string; priceCents?: number; currency?: string; enabled?: boolean }) {
  return app.db.tx(async (tx) => {
    const cur = (await tx.query("SELECT * FROM products WHERE key = $1 FOR UPDATE", [key])).rows[0];
    if (!cur) throw notFound("Product not found");
    const r = (await tx.query(
      `UPDATE products SET name = COALESCE($2,name), description = COALESCE($3,description), price_cents = COALESCE($4,price_cents),
         currency = COALESCE($5,currency), enabled = COALESCE($6,enabled), updated_by = $7, updated_at = now() WHERE key = $1 RETURNING *`,
      [key, p.name ?? null, p.description ?? null, p.priceCents ?? null, p.currency ?? null, p.enabled ?? null, c.user!.id])).rows[0];
    await audit(tx, actorOf(c), { action: "product.updated", targetType: "product", targetId: key,
      previous: { price: cur.price_cents, enabled: cur.enabled, name: cur.name }, next: { price: r.price_cents, enabled: r.enabled, name: r.name } });
    return r;
  });
}

/** What a user may buy right now, with the reason when they can't. */
export async function storefront(app: App, userId: string) {
  const { products, premiumEnabled, provider } = await listProducts(app);
  const premium = await hasEntitlement(app.db, userId, "premium");
  const verified = await hasEntitlement(app.db, userId, "verified");
  return {
    provider, premiumEnabled, premium, verified,
    products: products.map((p) => {
      let unavailableReason: string | null = null;
      if (!p.enabled) unavailableReason = "Not available";
      else if (p.key === "premium" && !premiumEnabled) unavailableReason = "Premium isn't available yet";
      else if (p.key === "premium" && premium) unavailableReason = "You already have Premium";
      else if (p.key === "verified" && verified) unavailableReason = "You're already verified";
      else if (!stripe()) unavailableReason = "Payments aren't set up yet";
      return { ...p, available: !unavailableReason, unavailableReason };
    }),
  };
}

export async function checkout(app: App, userId: string, productKey: string) {
  const p = (await app.db.query("SELECT * FROM products WHERE key = $1", [productKey])).rows[0];
  if (!p || !p.enabled) throw notFound("Product not available");
  if (p.key === "premium" && !(await getSetting<boolean>(app, "premium.enabled", false))) throw new HttpError(403, "premium_disabled", "Premium isn't available for purchase right now");
  if (p.key === "premium" && (await hasEntitlement(app.db, userId, "premium"))) throw conflict("You already have Premium");
  if (p.key === "verified" && (await hasEntitlement(app.db, userId, "verified"))) throw conflict("You're already verified");
  if (!stripe()) throw unavailable("Payments are not configured on this server", "payments_not_configured");
  const purchase = (await app.db.query(
    "INSERT INTO purchases (user_id, product_key, provider, amount_cents, currency) VALUES ($1,$2,'stripe',$3,$4) RETURNING id", [userId, p.key, p.price_cents, p.currency])).rows[0];
  const form: Record<string, string> = {
    mode: p.billing === "monthly" ? "subscription" : "payment",
    client_reference_id: purchase.id,
    "metadata[purchase_id]": purchase.id,
    success_url: `${app.cfg.appUrl}/dashboard/premium?checkout=success`,
    cancel_url: `${app.cfg.appUrl}/dashboard/premium?checkout=cancelled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": p.currency,
    "line_items[0][price_data][unit_amount]": String(p.price_cents),
    "line_items[0][price_data][product_data][name]": p.name,
  };
  if (p.billing === "monthly") {
    form["line_items[0][price_data][recurring][interval]"] = "month";
    form["subscription_data[metadata][purchase_id]"] = purchase.id;
  } else form["payment_intent_data[metadata][purchase_id]"] = purchase.id;
  const s = await stripeCall(app, "checkout/sessions", form, `checkout-${purchase.id}`);
  await app.db.query("UPDATE purchases SET provider_session_id = $2 WHERE id = $1", [purchase.id, s.id]);
  return { url: s.url as string, purchaseId: purchase.id };
}

// ------------------------------------------------------------------ webhooks

export function verifyStripeSignature(raw: Buffer, header: string, secret: string, toleranceSec = 300, now = Date.now()) {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]).filter((x) => x.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = header.split(",").filter((x) => x.trim().startsWith("v1=")).map((x) => x.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length) return false;
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.`).update(raw).digest("hex");
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

async function fulfil(app: App, db: Queryable, purchaseId: string, paymentRef: string, amount: number, currency: string, sub?: { id: string; periodEnd: Date | null }) {
  const pu = (await db.query("UPDATE purchases SET status = 'paid', paid_at = now() WHERE id = $1 AND status = 'pending' RETURNING *", [purchaseId])).rows[0];
  if (!pu) return false; // already fulfilled (duplicate or replayed event)
  await db.query("INSERT INTO payments (purchase_id, provider_payment_id, amount_cents, currency, status) VALUES ($1,$2,$3,$4,'succeeded') ON CONFLICT DO NOTHING", [purchaseId, paymentRef, amount, currency]);
  const product = (await db.query("SELECT grants, name FROM products WHERE key = $1", [pu.product_key])).rows[0];
  const g = product.grants as { entitlement?: "premium" | "verified"; badge?: string; badge_credits?: number };
  let subId: string | null = null;
  if (sub) {
    subId = (await db.query(
      `INSERT INTO subscriptions (user_id, product_key, provider, provider_sub_id, status, current_period_end) VALUES ($1,$2,'stripe',$3,'active',$4)
       ON CONFLICT (provider_sub_id) DO UPDATE SET status = 'active', current_period_end = EXCLUDED.current_period_end, updated_at = now() RETURNING id`,
      [pu.user_id, pu.product_key, sub.id, sub.periodEnd])).rows[0].id;
  }
  if (g.entitlement) {
    await db.query(
      "INSERT INTO entitlements (user_id, kind, source, purchase_id, subscription_id, expires_at, reason) VALUES ($1,$2,$3,$4,$5,$6,'purchase') ON CONFLICT DO NOTHING",
      [pu.user_id, g.entitlement, sub ? "subscription" : "purchase", pu.id, subId, sub?.periodEnd ?? null]);
    if (g.entitlement === "premium") await assignBadge(app, db, pu.user_id, "premium", { method: "purchase", actor: null, idempotencyKey: `purchase:${pu.id}:premium` }).catch(() => {});
  }
  if (g.badge) await assignBadge(app, db, pu.user_id, g.badge, { method: "purchase", actor: null, reason: "Purchased", idempotencyKey: `purchase:${pu.id}:${g.badge}` });
  if (g.badge_credits) await addCredits(db, pu.user_id, g.badge_credits, "purchase", pu.id);
  await notify(db, pu.user_id, "purchase", `Thanks! ${product.name} is now active`);
  return true;
}

export async function handleStripeWebhook(app: App, raw: Buffer, signature: string) {
  const s = stripe();
  if (!s) throw unavailable("Payments are not configured", "payments_not_configured");
  if (!verifyStripeSignature(raw, signature, s.webhookSecret)) throw new HttpError(400, "invalid_signature", "Invalid webhook signature");
  const ev = JSON.parse(raw.toString("utf8"));
  const fresh = await app.db.query("INSERT INTO webhook_events (provider, event_id, type, payload) VALUES ('stripe',$1,$2,$3) ON CONFLICT DO NOTHING", [ev.id, ev.type, asJson(ev)]);
  if (!fresh.rowCount) {
    const prev = (await app.db.query("SELECT processed_at FROM webhook_events WHERE provider = 'stripe' AND event_id = $1", [ev.id])).rows[0];
    if (prev.processed_at) return { duplicate: true };
  }
  try {
    await app.db.tx(async (tx) => {
      const o = ev.data.object;
      if (ev.type === "checkout.session.completed" && (o.payment_status === "paid" || o.payment_status === "no_payment_required")) {
        const purchaseId = o.metadata?.purchase_id ?? o.client_reference_id;
        let sub: { id: string; periodEnd: Date | null } | undefined;
        if (o.mode === "subscription" && o.subscription) {
          const end = o.subscription_details?.current_period_end ?? o.expires_at ?? null;
          sub = { id: typeof o.subscription === "string" ? o.subscription : o.subscription.id, periodEnd: end ? new Date((end + 3 * 86400) * 1000) : new Date(Date.now() + 33 * 86400_000) };
        }
        await fulfil(app, tx, purchaseId, o.payment_intent ?? o.invoice ?? o.id, o.amount_total ?? 0, o.currency ?? "usd", sub);
      } else if (ev.type === "invoice.paid" && o.subscription) {
        const end = o.lines?.data?.[0]?.period?.end;
        const until = end ? new Date((end + 3 * 86400) * 1000) : null; // 3-day grace
        const sub = (await tx.query("UPDATE subscriptions SET status = 'active', current_period_end = COALESCE($2, current_period_end), updated_at = now() WHERE provider_sub_id = $1 RETURNING id", [o.subscription, until])).rows[0];
        if (sub) await tx.query("UPDATE entitlements SET expires_at = COALESCE($2, expires_at) WHERE subscription_id = $1 AND revoked_at IS NULL", [sub.id, until]);
        await tx.query("INSERT INTO payments (purchase_id, provider_payment_id, amount_cents, currency, status) SELECT e.purchase_id, $1, $2, $3, 'succeeded' FROM entitlements e WHERE e.subscription_id = $4 LIMIT 1 ON CONFLICT DO NOTHING",
          [o.id, o.amount_paid ?? 0, o.currency ?? "usd", sub?.id ?? null]);
      } else if (ev.type === "invoice.payment_failed" && o.subscription) {
        await tx.query("UPDATE subscriptions SET status = 'past_due', updated_at = now() WHERE provider_sub_id = $1", [o.subscription]);
        await tx.query("INSERT INTO payments (provider_payment_id, amount_cents, currency, status) VALUES ($1,$2,$3,'failed') ON CONFLICT DO NOTHING", [o.id, o.amount_due ?? 0, o.currency ?? "usd"]);
      } else if (ev.type === "customer.subscription.updated" || ev.type === "customer.subscription.deleted") {
        const status = ev.type.endsWith("deleted") ? "canceled" : o.status;
        const sub = (await tx.query("UPDATE subscriptions SET status = $2, cancel_at_period_end = $3, current_period_end = COALESCE(to_timestamp($4), current_period_end), updated_at = now() WHERE provider_sub_id = $1 RETURNING id",
          [o.id, status, !!o.cancel_at_period_end, o.current_period_end ?? null])).rows[0];
        if (sub && status === "canceled") await tx.query("UPDATE entitlements SET expires_at = LEAST(COALESCE(expires_at, now()), now()) WHERE subscription_id = $1 AND revoked_at IS NULL", [sub.id]);
      } else if (ev.type === "charge.refunded") {
        const purchaseId = o.metadata?.purchase_id;
        const pu = purchaseId ? (await tx.query("SELECT * FROM purchases WHERE id = $1 FOR UPDATE", [purchaseId])).rows[0] : null;
        if (pu) {
          const full = o.amount_refunded >= o.amount;
          for (const rf of o.refunds?.data ?? [{ id: `${o.id}-refund`, amount: o.amount_refunded }]) {
            await tx.query("INSERT INTO refunds (purchase_id, provider_refund_id, amount_cents, reason) VALUES ($1,$2,$3,$4) ON CONFLICT (provider_refund_id) DO NOTHING", [pu.id, rf.id, rf.amount, rf.reason ?? null]);
          }
          await tx.query("UPDATE purchases SET status = $2 WHERE id = $1", [pu.id, full ? "refunded" : "partially_refunded"]);
          if (full) {
            await tx.query("UPDATE entitlements SET revoked_at = now(), reason = 'refunded' WHERE purchase_id = $1 AND revoked_at IS NULL", [pu.id]);
            const g = (await tx.query("SELECT grants FROM products WHERE key = $1", [pu.product_key])).rows[0].grants;
            if (g.badge) await tx.query("DELETE FROM user_badges ub USING badges b WHERE ub.badge_id = b.id AND b.key = $2 AND ub.user_id = $1 AND ub.method = 'purchase'", [pu.user_id, g.badge]);
          }
        }
      }
      await tx.query("UPDATE webhook_events SET processed_at = now(), error = NULL WHERE provider = 'stripe' AND event_id = $1", [ev.id]);
    });
  } catch (e) {
    await app.db.query("UPDATE webhook_events SET error = $2 WHERE provider = 'stripe' AND event_id = $1", [ev.id, (e as Error).message.slice(0, 500)]);
    throw e; // non-2xx → Stripe retries
  }
  return { duplicate: false };
}

// ------------------------------------------------------------------ admin

export async function grantEntitlement(app: App, c: Ctx, userId: string, kind: "premium" | "verified", expiresAt: Date | null, reason: string) {
  await app.db.tx(async (tx) => {
    const u = (await tx.query("SELECT uid, username FROM users WHERE id = $1 AND deleted_at IS NULL", [userId])).rows[0];
    if (!u) throw notFound("User not found");
    if (await hasEntitlement(tx, userId, kind)) throw conflict(`User already has ${kind}`);
    await tx.query("INSERT INTO entitlements (user_id, kind, source, expires_at, granted_by, reason) VALUES ($1,$2,'admin_grant',$3,$4,$5)", [userId, kind, expiresAt, c.user!.id, reason]);
    await assignBadge(app, tx, userId, kind, { method: "admin_grant", actor: { ctx: c, canAssign: true, canRestricted: true }, reason, idempotencyKey: `grant:${kind}:${userId}:${Date.now()}` }).catch(() => false);
    await audit(tx, actorOf(c), { action: `${kind}.granted`, targetUserId: userId, targetUid: Number(u.uid), targetUsername: u.username, next: { expiresAt }, reason });
  });
  const { invalidateProfileCache } = await import("../profiles/service.ts");
  invalidateProfileCache(app, userId);
}

export async function revokeEntitlement(app: App, c: Ctx, userId: string, kind: "premium" | "verified", reason: string) {
  await app.db.tx(async (tx) => {
    const u = (await tx.query("SELECT uid, username FROM users WHERE id = $1", [userId])).rows[0];
    const r = await tx.query("UPDATE entitlements SET revoked_at = now(), revoked_by = $3, reason = $4 WHERE user_id = $1 AND kind = $2 AND revoked_at IS NULL RETURNING source", [userId, kind, c.user!.id, reason]);
    if (!r.rowCount) throw notFound(`User has no active ${kind}`);
    await tx.query("DELETE FROM user_badges ub USING badges b WHERE ub.badge_id = b.id AND b.key = $2 AND ub.user_id = $1", [userId, kind]);
    await audit(tx, actorOf(c), { action: `${kind}.revoked`, targetUserId: userId, targetUid: Number(u.uid), targetUsername: u.username, previous: { sources: r.rows.map((x) => x.source) }, reason });
  });
  const { invalidateProfileCache } = await import("../profiles/service.ts");
  invalidateProfileCache(app, userId);
}

export async function refund(app: App, c: Ctx, purchaseId: string, amountCents: number | null, reason: string) {
  const pu = (await app.db.query("SELECT p.*, pay.provider_payment_id FROM purchases p LEFT JOIN payments pay ON pay.purchase_id = p.id AND pay.status = 'succeeded' WHERE p.id = $1 ORDER BY pay.at LIMIT 1", [purchaseId])).rows[0];
  if (!pu) throw notFound("Purchase not found");
  if (pu.status !== "paid" && pu.status !== "partially_refunded") throw conflict(`Purchase is ${pu.status}`);
  if (!pu.provider_payment_id) throw badRequest("No captured payment to refund");
  const form: Record<string, string> = { metadata: "", reason: "requested_by_customer" };
  delete form.metadata;
  form[pu.provider_payment_id.startsWith("pi_") ? "payment_intent" : "charge"] = pu.provider_payment_id;
  if (amountCents) form.amount = String(amountCents);
  const r = await stripeCall(app, "refunds", form, `refund-${purchaseId}-${amountCents ?? "full"}`);
  await app.db.query("INSERT INTO refunds (purchase_id, provider_refund_id, amount_cents, reason, requested_by, status) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider_refund_id) DO NOTHING",
    [purchaseId, r.id, r.amount, reason, c.user!.id, r.status]);
  await audit(app.db, actorOf(c), { action: "payment.refunded", targetUserId: pu.user_id, targetType: "purchase", targetId: purchaseId, next: { amount: r.amount, status: r.status }, reason });
  return { refundId: r.id, status: r.status };
}

export async function cancelSubscription(app: App, userId: string) {
  const sub = (await app.db.query("SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('active','past_due') ORDER BY created_at DESC LIMIT 1", [userId])).rows[0];
  if (!sub) throw notFound("No active subscription");
  await stripeCall(app, `subscriptions/${sub.provider_sub_id}`, { cancel_at_period_end: "true" });
  await app.db.query("UPDATE subscriptions SET cancel_at_period_end = true, updated_at = now() WHERE id = $1", [sub.id]);
  return { cancelAtPeriodEnd: true, currentPeriodEnd: sub.current_period_end };
}

export async function billingSummary(app: App, userId: string) {
  return {
    purchases: (await app.db.query("SELECT p.id, p.product_key, p.amount_cents, p.currency, p.status, p.created_at, p.paid_at, pr.name FROM purchases p JOIN products pr ON pr.key = p.product_key WHERE p.user_id = $1 AND p.status <> 'pending' ORDER BY p.created_at DESC", [userId])).rows,
    subscription: (await app.db.query("SELECT status, current_period_end, cancel_at_period_end, product_key FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [userId])).rows[0] ?? null,
    entitlements: (await app.db.query("SELECT kind, source, starts_at, expires_at FROM entitlements WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())", [userId])).rows,
    badgeCredits: Number((await app.db.query("SELECT balance FROM badge_credits WHERE user_id = $1", [userId])).rows[0]?.balance ?? 0),
  };
}
