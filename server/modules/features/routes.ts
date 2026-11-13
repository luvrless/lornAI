/** User-facing feature routes: badges, templates, analytics, billing, support, overview. */
import type { App } from "../../app.ts";
import { Router, z } from "../../lib/http.ts";
import { HttpError } from "../../lib/errors.ts";
import * as B from "../badges/service.ts";
import { claimBoosterBadge } from "../badges/booster.ts";
import * as T from "../templates/service.ts";
import * as A from "../analytics/service.ts";
import * as $ from "../monetization/service.ts";
import * as Adm from "../admin/service.ts";
import { hex } from "../../../shared/profile-schema.ts";
import { profileCompletion } from "../profiles/service.ts";
import { quotaFor } from "../media/service.ts";
import { activeEntitlements } from "../monetization/entitlements.ts";
import { WIDGETS } from "../../../shared/widgets.ts";
import { integrationStatus } from "../integrations/service.ts";

const range = (q: Record<string, string>) => {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 86400_000);
  if (isNaN(+from) || isNaN(+to) || from >= to) throw new HttpError(422, "validation_failed", "Invalid date range");
  if (to.getTime() - from.getTime() > 400 * 86400_000) throw new HttpError(422, "validation_failed", "Range is limited to 400 days");
  return { from, to };
};

export function featureRoutes(app: App, r: Router) {
  // ------------------------------------------------------------ overview
  r.get("/api/dashboard/overview", async (c) => {
    const id = c.user!.id;
    const now = new Date();
    const stats = await A.stats(app, id, new Date(now.getTime() - 30 * 86400_000), now);
    const p = (await app.db.query("SELECT is_published, published_at, draft_updated_at, moderation_hidden FROM profiles WHERE user_id = $1", [id])).rows[0];
    const { activeAnnouncements } = await import("../admin/service.ts");
    return {
      user: c.user, url: `${app.cfg.appUrl}/${c.user!.username}`, profile: p, completion: await profileCompletion(app, id),
      analytics: { views30d: stats.totals.views, uniques30d: stats.totals.uniques, clicks30d: stats.totals.clicks, allTime: stats.allTime, series: stats.series, previous: stats.previous },
      badges: await B.myBadges(app, id), entitlements: await activeEntitlements(app.db, id), storage: await quotaFor(app, id),
      createdAt: (await app.db.query("SELECT created_at FROM users WHERE id = $1", [id])).rows[0].created_at,
      activity: (await app.db.query(
        `(SELECT 'security' AS kind, kind AS what, at FROM security_events WHERE user_id = $1)
         UNION ALL (SELECT 'publish', 'Published version ' || version, created_at FROM profile_versions WHERE user_id = $1)
         UNION ALL (SELECT 'upload', 'Uploaded ' || name, created_at FROM assets WHERE user_id = $1 AND purpose = 'user')
         ORDER BY at DESC LIMIT 12`, [id])).rows,
      announcements: await activeAnnouncements(app),
      unreadNotifications: Number((await app.db.query("SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL", [id])).rows[0].count),
    };
  }, { auth: "required" });

  r.get("/api/meta/widgets", async () => Object.entries(WIDGETS).map(([type, w]) => ({ type, category: w.category, label: w.label, defaults: w.schema.parse({}) })));
  r.get("/api/meta/integrations", async () => integrationStatus());
  r.get("/api/announcements", async () => Adm.activeAnnouncements(app), { maintenanceExempt: true });

  // ------------------------------------------------------------ badges
  r.get("/api/badges/me", async (c) => ({ badges: await B.myBadges(app, c.user!.id), credits: await B.creditBalance(app.db, c.user!.id),
    customRequests: (await app.db.query("SELECT id, name, color, status, review_note, created_at FROM custom_badges WHERE user_id = $1 ORDER BY created_at DESC", [c.user!.id])).rows }), { auth: "required" });
  r.get("/api/badges/catalogue", async (c) => B.badgeCatalogue(app, c.user!.id), { auth: "required" });
  r.post("/api/badges/server-booster/claim", async (c) => claimBoosterBadge(app, c.user!.id),
    { auth: "required", rate: { name: "booster", rule: { capacity: 5, refillPerSec: 5 / 600 }, by: "user" } });
  r.put("/api/badges/me/arrangement", async (c) => {
    const b = await c.body(z.object({ order: z.array(z.string().uuid()).max(200), hidden: z.array(z.string().uuid()).max(200) }));
    await B.setUserBadgePrefs(app, c.user!.id, b.order, b.hidden);
  }, { auth: "required" });
  r.post("/api/badges/custom", async (c) => B.requestCustomBadge(app, c.user!.id, await c.body(z.object({ name: z.string().trim().min(1).max(30), iconAssetId: z.string().uuid(), color: hex }))),
    { auth: "required" });

  // ------------------------------------------------------------ templates
  const kind = z.enum(["full", "background", "card", "typography", "animation", "effects"]);
  r.get("/api/templates", async (c) => T.browse(app, c.user?.id ?? null, z.object({
    search: z.string().max(60).optional(), kind: kind.optional(), sort: z.enum(["popular", "new", "favorites"]).default("popular"),
    mine: z.coerce.boolean().optional(), favorites: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(60).default(24), offset: z.coerce.number().int().min(0).default(0),
  }).parse(c.query)), { auth: "optional" });
  r.get("/api/templates/:id", async (c) => T.getTemplate(app, c.user?.id ?? null, z.string().uuid().parse(c.params.id)), { auth: "optional" });
  r.post("/api/templates", async (c) => T.createTemplate(app, c.user!.id, await c.body(z.object({
    name: z.string().trim().min(1).max(60), description: z.string().max(500).default(""), kind, visibility: z.enum(["public", "private", "unlisted"]).default("private"),
    tags: z.array(z.string().trim().toLowerCase().max(20)).max(8).default([]), fromDraft: z.boolean().default(true), config: z.unknown().optional(),
    previewAssetId: z.string().uuid().nullable().optional(),
  }))), { auth: "required", rate: { name: "tpl", rule: { capacity: 20, refillPerSec: 20 / 3600 }, by: "user" } });
  r.patch("/api/templates/:id", async (c) => T.updateTemplate(app, c.user!.id, c.params.id, await c.body(z.object({
    name: z.string().trim().min(1).max(60).optional(), description: z.string().max(500).optional(), visibility: z.enum(["public", "private", "unlisted"]).optional(),
    tags: z.array(z.string().max(20)).max(8).optional(), config: z.unknown().optional(),
  }))), { auth: "required" });
  r.delete("/api/templates/:id", async (c) => T.deleteTemplate(app, c.user!.id, c.params.id), { auth: "required" });
  r.put("/api/templates/:id/favorite", async (c) => T.favorite(app, c.user!.id, c.params.id, (await c.body(z.object({ on: z.boolean() }))).on), { auth: "required" });
  r.post("/api/templates/:id/apply", async (c) => {
    const b = await c.body(z.object({ confirm: z.boolean(), rev: z.number().int() }));
    return T.applyTemplate(app, c.user!.id, c.params.id, b.confirm, b.rev);
  }, { auth: "required" });

  // ------------------------------------------------------------ analytics
  r.get("/api/analytics", async (c) => { const { from, to } = range(c.query); return A.stats(app, c.user!.id, from, to); }, { auth: "required" });
  r.get("/api/analytics/export", async (c) => {
    const { from, to } = range(c.query);
    c.send(200, await A.exportCsv(app, c.user!.id, from, to), "text/csv; charset=utf-8", { "Content-Disposition": `attachment; filename="lorn-analytics-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv"` });
  }, { auth: "required" });

  // ------------------------------------------------------------ billing
  r.get("/api/billing", async (c) => ({ ...(await $.storefront(app, c.user!.id)), ...(await $.billingSummary(app, c.user!.id)) }), { auth: "required" });
  r.post("/api/billing/checkout", async (c) => {
    const b = await c.body(z.object({
      product: z.enum(["premium", "badge_pack", "verified", "donation"]),
      amountCents: z.number().int().positive().optional(),
      giftTo: z.string().trim().min(1).max(32).optional(),
    }));
    return $.checkout(app, c.user!.id, b.product, { amountCents: b.amountCents, giftTo: b.giftTo });
  },
    { auth: "required", rate: { name: "checkout", rule: { capacity: 10, refillPerSec: 10 / 3600 }, by: "user" } });
  r.post("/api/billing/cancel", async (c) => $.cancelSubscription(app, c.user!.id), { auth: "required" });

  // Webhook: raw body, signature-verified, no session or CSRF.
  r.post("/api/webhooks/stripe", async (c) => {
    const chunks: Buffer[] = [];
    let n = 0;
    for await (const ch of c.req) { n += (ch as Buffer).length; if (n > 1_000_000) throw new HttpError(413, "payload_too_large", "Too large"); chunks.push(ch as Buffer); }
    return $.handleStripeWebhook(app, Buffer.concat(chunks), String(c.req.headers["stripe-signature"] ?? ""));
  }, { skipCsrf: true, maintenanceExempt: true });

  // ------------------------------------------------------------ support
  const cat = z.enum(["account", "billing", "profile", "bug", "report", "other"]);
  r.get("/api/support/tickets", async (c) => (await app.db.query("SELECT id, number, category, subject, status, created_at, updated_at FROM support_tickets WHERE user_id = $1 ORDER BY updated_at DESC", [c.user!.id])).rows, { auth: "required" });
  r.post("/api/support/tickets", async (c) => Adm.createTicket(app, c.user!.id, await c.body(z.object({
    category: cat, subject: z.string().trim().min(3).max(120), body: z.string().trim().min(10).max(8000), attachmentIds: z.array(z.string().uuid()).max(5).default([]),
  }))), { auth: "required", rate: { name: "ticket", rule: { capacity: 5, refillPerSec: 5 / 3600 }, by: "user" } });
  r.get("/api/support/tickets/:id", async (c) => Adm.ticketThread(app, z.string().uuid().parse(c.params.id), { userId: c.user!.id, staff: false }), { auth: "required" });
  r.post("/api/support/tickets/:id/messages", async (c) => {
    const b = await c.body(z.object({ body: z.string().trim().min(1).max(8000), attachmentIds: z.array(z.string().uuid()).max(5).default([]) }));
    await Adm.replyTicket(app, c.params.id, { userId: c.user!.id, staff: false }, b.body, false, b.attachmentIds);
  }, { auth: "required", rate: { name: "ticketmsg", rule: { capacity: 20, refillPerSec: 0.05 }, by: "user" } });
  r.post("/api/support/tickets/:id/close", async (c) => Adm.updateTicket(app, null, c.user!.id, c.params.id, { status: "closed" }), { auth: "required" });
  r.get("/api/reports/mine", async (c) => (await app.db.query("SELECT r.id, r.category, r.status, r.resolution, r.created_at, t.username AS target FROM reports r LEFT JOIN users t ON t.id = r.target_user_id WHERE r.reporter_id = $1 ORDER BY r.created_at DESC", [c.user!.id])).rows, { auth: "required" });
}
