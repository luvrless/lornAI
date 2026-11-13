/** Admin control-center routes (Phase 6). Each route declares its permission. */
import type { App } from "../../app.ts";
import { Router, z } from "../../lib/http.ts";
import { HttpError } from "../../lib/errors.ts";
import * as S from "./service.ts";
import * as B from "../badges/service.ts";
import * as E from "../events/service.ts";
import * as $ from "../monetization/service.ts";
import * as M from "../media/service.ts";
import { audit, getSetting, setSetting } from "../platform/service.ts";
import { actorOf } from "../authz/service.ts";
import { healthCheck } from "../integrations/service.ts";
import { jobStats, enqueue } from "../jobs/runner.ts";
import { configStatus } from "../../lib/config.ts";

const reason = z.string().trim().min(3, "Give a reason").max(500);
const uid = (s: string) => z.string().uuid().parse(s);
const range = (q: Record<string, string>) => {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 86400_000);
  if (isNaN(+from) || isNaN(+to) || from >= to) throw new HttpError(422, "validation_failed", "Invalid date range");
  return { from, to };
};

import { boosterStatus } from "../badges/booster.ts";

export function adminPanelRoutes(app: App, r: Router) {
  r.get("/api/admin/dashboard", async (c) => { const { from, to } = range(c.query); return S.dashboardStats(app, c, from, to); }, { perm: [] });
  r.get("/api/admin/system", async () => ({
    config: configStatus(app.cfg), storage: app.storageStatus, payments: $.paymentStatus(), serverBooster: boosterStatus(), jobs: await jobStats(app.db),
    deadJobs: (await app.db.query("SELECT id, kind, attempts, last_error, created_at FROM jobs WHERE status = 'dead' ORDER BY id DESC LIMIT 50")).rows,
    integrations: await healthCheck(app), db: { pool: app.db.stats }, node: process.version, uptimeSec: Math.round(process.uptime()),
  }), { perm: "settings.view" });
  r.post("/api/admin/system/jobs/:id/retry", async (c) => {
    const x = await app.db.query("UPDATE jobs SET status = 'queued', attempts = 0, run_at = now() WHERE id = $1 AND status = 'dead' RETURNING kind", [c.params.id]);
    if (!x.rowCount) throw new HttpError(404, "not_found", "Job not found");
    await audit(app.db, actorOf(c), { action: "job.retried", targetType: "job", targetId: c.params.id });
  }, { perm: "settings.edit" });

  // ------------------------------------------------------------ users
  r.get("/api/admin/users", async (c) => S.searchUsers(app, c, z.object({
    q: z.string().max(254).optional(), status: z.enum(["active", "deleted"]).optional(), premium: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    verified: z.enum(["true", "false"]).transform((v) => v === "true").optional(), role: z.enum(["OWNER", "ADMIN", "STAFF"]).optional(), badge: z.string().max(40).optional(),
    banned: z.enum(["true", "false"]).transform((v) => v === "true").optional(), locked: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    from: z.coerce.date().optional(), to: z.coerce.date().optional(),
    sort: z.enum(["uid", "-uid", "created", "-created", "username", "last_login"]).default("-uid"),
    limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).default(0),
  }).parse(c.query)), { perm: "users.search" });
  r.get("/api/admin/users/:id", async (c) => S.inspectUser(app, c, uid(c.params.id)), { perm: "users.view" });
  r.post("/api/admin/users/:id/username", async (c) => { const b = await c.body(z.object({ username: z.string().trim().min(1).max(12), reason })); await S.changeUsername(app, c, uid(c.params.id), b.username, b.reason); }, { perm: "users.edit_username" });
  r.post("/api/admin/users/:id/email", async (c) => { const b = await c.body(z.object({ email: z.string().trim().toLowerCase().email(), reason })); await S.changeEmail(app, c, uid(c.params.id), b.email, b.reason); }, { perm: "users.change_email" });
  r.post("/api/admin/users/:id/recover", async (c) => S.initiateRecovery(app, c, uid(c.params.id), (await c.body(z.object({ reason }))).reason), { perm: "users.recover_password" });
  r.post("/api/admin/users/:id/lock", async (c) => S.lockAccount(app, c, uid(c.params.id), (await c.body(z.object({ reason }))).reason), { perm: "users.lock" });
  r.post("/api/admin/users/:id/unlock", async (c) => S.unlockAccount(app, c, uid(c.params.id), (await c.body(z.object({ reason }))).reason), { perm: "users.unlock" });
  r.post("/api/admin/users/:id/ban", async (c) => {
    const b = await c.body(z.object({ reason, expiresAt: z.coerce.date().nullable() }));
    if (!c.can(b.expiresAt ? "users.ban_temporary" : "users.ban_permanent")) throw new HttpError(403, "forbidden", `Missing permission: users.ban_${b.expiresAt ? "temporary" : "permanent"}`);
    await S.banAccount(app, c, uid(c.params.id), b.reason, b.expiresAt);
  }, { perm: [] });
  r.post("/api/admin/users/:id/unban", async (c) => S.unban(app, c, uid(c.params.id), (await c.body(z.object({ reason }))).reason), { perm: "users.unban" });
  r.post("/api/admin/users/:id/delete", async (c) => { const b = await c.body(z.object({ reason, confirmUsername: z.string() })); await S.adminDeleteAccount(app, c, uid(c.params.id), b.reason, b.confirmUsername); }, { perm: "users.delete" });
  r.post("/api/admin/users/:id/sessions/revoke", async (c) => S.revokeUserSessions(app, c, uid(c.params.id), (await c.body(z.object({ reason }))).reason), { perm: "sessions.manage" });
  r.post("/api/admin/users/:id/notes", async (c) => S.addNote(app, c, uid(c.params.id), (await c.body(z.object({ body: z.string().trim().min(1).max(4000) }))).body), { perm: "users.notes" });
  r.post("/api/admin/users/:id/warn", async (c) => S.warnUser(app, c, uid(c.params.id), (await c.body(z.object({ reason }))).reason), { perm: "moderation.warn" });
  r.post("/api/admin/users/:id/flag", async (c) => { const b = await c.body(z.object({ reason: z.string().max(500).default(""), clear: z.boolean().default(false) })); await S.flagUser(app, c, uid(c.params.id), b.reason || "flagged", b.clear); }, { perm: "users.flag" });
  r.post("/api/admin/users/:id/profile-visibility", async (c) => { const b = await c.body(z.object({ hidden: z.boolean(), reason })); await S.hideProfile(app, c, uid(c.params.id), b.hidden, b.reason); }, { perm: "moderation.ban" });
  r.post("/api/admin/users/:id/badges", async (c) => {
    const b = await c.body(z.object({ badgeId: z.string().uuid(), reason: z.string().max(500).default("") }));
    const ok = await app.db.tx((tx) => B.assignBadge(app, tx, uid(c.params.id), b.badgeId, { method: "manual", reason: b.reason, actor: { ctx: c, canAssign: c.can("badges.assign"), canRestricted: c.can("badges.assign_restricted") } }));
    if (!ok) throw new HttpError(409, "conflict", "User already has this badge");
    return { assigned: true };
  }, { perm: "badges.assign" });
  r.delete("/api/admin/users/:id/badges/:badge", async (c) => B.revokeBadge(app, c, uid(c.params.id), uid(c.params.badge), (await c.body(z.object({ reason }))).reason), { perm: "badges.revoke" });
  r.post("/api/admin/users/:id/premium", async (c) => { const b = await c.body(z.object({ expiresAt: z.coerce.date().nullable(), reason })); await $.grantEntitlement(app, c, uid(c.params.id), "premium", b.expiresAt, b.reason); }, { perm: "premium.grant" });
  r.delete("/api/admin/users/:id/premium", async (c) => $.revokeEntitlement(app, c, uid(c.params.id), "premium", (await c.body(z.object({ reason }))).reason), { perm: "premium.revoke" });
  r.post("/api/admin/users/:id/verified", async (c) => { const b = await c.body(z.object({ reason })); await $.grantEntitlement(app, c, uid(c.params.id), "verified", null, b.reason); }, { perm: "badges.assign_restricted" });
  r.delete("/api/admin/users/:id/verified", async (c) => $.revokeEntitlement(app, c, uid(c.params.id), "verified", (await c.body(z.object({ reason }))).reason), { perm: "badges.assign_restricted" });
  r.post("/api/admin/users/:id/credits", async (c) => {
    const b = await c.body(z.object({ delta: z.number().int().min(-100).max(100), reason }));
    const ref = `admin:${Date.now()}`;
    await app.db.tx(async (tx) => {
      const bal = await B.creditBalance(tx, uid(c.params.id));
      if (bal + b.delta < 0) throw new HttpError(400, "bad_request", "Balance can't go below zero");
      await B.addCredits(tx, uid(c.params.id), b.delta, "admin_adjustment", ref);
      await audit(tx, actorOf(c), { action: "credits.adjusted", targetUserId: uid(c.params.id), next: { delta: b.delta }, reason: b.reason });
    });
  }, { perm: "premium.grant" });
  r.get("/api/admin/users/:id/audit", async (c) => (await app.db.query(
    "SELECT a.id, a.action, a.reason, a.previous_state, a.new_state, a.at, u.username AS actor FROM admin_audit_log a LEFT JOIN users u ON u.id = a.actor_user_id WHERE a.target_user_id = $1 ORDER BY a.id DESC LIMIT 200", [uid(c.params.id)])).rows,
    { perm: "audit.view" });

  // ------------------------------------------------------------ badges
  r.get("/api/admin/badges", async (c) => B.listBadges(app, { search: c.query.search, category: c.query.category, includeArchived: c.query.archived === "1" }), { perm: "badges.view" });
  r.post("/api/admin/badges", async (c) => B.createBadge(app, c, await c.body(B.badgeInput)), { perm: "badges.create" });
  r.patch("/api/admin/badges/:id", async (c) => {
    const b = await c.body(B.badgeInput.partial().extend({ reason: z.string().max(500).optional() }));
    const { reason: why, ...patch } = b;
    const onlyToggle = Object.keys(patch).every((k) => k === "enabled");
    if (!onlyToggle) c.require("badges.edit");
    return B.updateBadge(app, c, uid(c.params.id), patch, why);
  }, { perm: "badges.view" });
  r.post("/api/admin/badges/:id/archive", async (c) => { const b = await c.body(z.object({ archived: z.boolean(), reason: z.string().max(500).optional() })); await B.archiveBadge(app, c, uid(c.params.id), b.archived, b.reason); }, { perm: "badges.disable" });
  r.delete("/api/admin/badges/:id", async (c) => B.deleteBadge(app, c, uid(c.params.id), (await c.body(z.object({ confirmKey: z.string() }))).confirmKey), { perm: "badges.delete" });
  r.get("/api/admin/badges/:id/recipients", async (c) => B.badgeRecipients(app, uid(c.params.id), c.query.search, Math.min(200, Number(c.query.limit ?? 100)), Number(c.query.offset ?? 0)), { perm: "badges.view" });
  r.get("/api/admin/badges/:id/history", async (c) => B.badgeHistory(app, uid(c.params.id), null), { perm: "badges.view" });
  r.get("/api/admin/badge-history", async (c) => B.badgeHistory(app, null, c.query.user ? uid(c.query.user) : null), { perm: "badges.view" });
  r.post("/api/admin/badges/upload", async (c) => {
    const b = await c.body(z.object({ filename: z.string().max(200), mime: z.string().max(100), size: z.number().int().positive() }));
    return M.startUpload(app, c.user!.id, { ...b, kind: "icon", purpose: "badge" });
  }, { perm: ["badges.create"] });
  r.post("/api/admin/badges/upload/:id/complete", async (c) => {
    const a = await M.completeUpload(app, c.user!.id, uid(c.params.id));
    // Badge artwork is platform-owned so a staff member's account changes can't affect it.
    await app.db.query("UPDATE assets SET user_id = NULL WHERE id = $1 AND purpose = 'badge'", [a.id]);
    return a;
  }, { perm: ["badges.create"] });
  r.get("/api/admin/custom-badges", async (c) => (await app.db.query(
    `SELECT cb.*, u.uid, u.username, a.storage_key FROM custom_badges cb JOIN users u ON u.id = cb.user_id JOIN assets a ON a.id = cb.icon_asset_id
     WHERE ($1::text IS NULL OR cb.status = $1) ORDER BY cb.created_at`, [c.query.status ?? null])).rows.map((x) => ({ ...x, iconUrl: app.storage.publicUrl(x.storage_key), storage_key: undefined })),
    { perm: "badges.review_custom" });
  r.post("/api/admin/custom-badges/:id/review", async (c) => { const b = await c.body(z.object({ decision: z.enum(["approve", "reject"]), note: z.string().max(500).default("") })); return B.reviewCustomBadge(app, c, uid(c.params.id), b.decision, b.note); }, { perm: "badges.review_custom" });

  // ------------------------------------------------------------ events & milestones
  r.get("/api/admin/events", async () => E.listEvents(app), { perm: "badges.view" });
  r.post("/api/admin/events", async (c) => E.createEvent(app, c, await c.body(E.eventInput)), { perm: "badges.manage_events" });
  r.patch("/api/admin/events/:id", async (c) => E.updateEvent(app, c, uid(c.params.id), await c.body(E.eventInput.partial().extend({ ownerOverride: z.boolean().optional(), reason: z.string().max(500).optional() }))), { perm: "badges.manage_events" });
  r.get("/api/admin/events/:id/preview", async (c) => E.previewRecipients(app, uid(c.params.id)), { perm: "badges.manage_events" });
  r.post("/api/admin/events/:id/distribute", async (c) => {
    const res = await E.startDistribution(app, uid(c.params.id), "manual", c.user!.id);
    await audit(app.db, actorOf(c), { action: "event.started", targetType: "event", targetId: c.params.id, next: res });
    return res;
  }, { perm: "badges.manage_events" });
  r.post("/api/admin/events/:id/retry", async (c) => {
    const res = await E.startDistribution(app, uid(c.params.id), "retry", c.user!.id);
    await audit(app.db, actorOf(c), { action: "event.retried", targetType: "event", targetId: c.params.id, next: res });
    return res;
  }, { perm: "badges.manage_events" });
  r.get("/api/admin/events/:id/recipients", async (c) => E.eventRecipients(app, uid(c.params.id), c.query.status), { perm: "badges.manage_events" });
  r.get("/api/admin/events/:id/recipients.csv", async (c) => {
    const rows = await E.eventRecipients(app, uid(c.params.id));
    c.send(200, ["uid,username,status,attempts,error,updated_at", ...rows.map((x) => [x.uid, x.username, x.status, x.attempts, `"${(x.error ?? "").replace(/"/g, '""')}"`, x.updated_at.toISOString()].join(","))].join("\n"),
      "text/csv; charset=utf-8", { "Content-Disposition": `attachment; filename="event-${c.params.id}-recipients.csv"` });
  }, { perm: "badges.manage_events" });
  r.get("/api/admin/events/:id/history", async (c) => E.eventHistory(app, uid(c.params.id)), { perm: "badges.manage_events" });
  r.get("/api/admin/milestones", async () => E.milestoneStatus(app), { perm: "badges.view" });
  r.post("/api/admin/milestones/reconcile", async (c) => {
    await enqueue(app.db, "milestone.og_reconcile", {}, { idempotencyKey: `og-reconcile:${Date.now()}` });
    await audit(app.db, actorOf(c), { action: "milestone.reconcile_requested", targetType: "milestone", targetId: "og" });
  }, { perm: "badges.manage_events" });

  // ------------------------------------------------------------ moderation & support
  r.get("/api/admin/reports", async (c) => S.listReports(app, z.object({ status: z.string().optional(), category: z.string().optional(), assigned: z.string().uuid().optional(), limit: z.coerce.number().int().max(100).default(50), offset: z.coerce.number().int().min(0).default(0) }).parse(c.query)), { perm: "moderation.view" });
  r.get("/api/admin/reports/:id", async (c) => S.getReport(app, uid(c.params.id)), { perm: "moderation.view" });
  r.patch("/api/admin/reports/:id", async (c) => S.updateReport(app, c, uid(c.params.id), await c.body(z.object({
    status: z.enum(["pending", "under_review", "resolved", "rejected"]).optional(), priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assignToMe: z.boolean().optional(), unassign: z.boolean().optional(), resolution: z.string().max(2000).optional(), note: z.string().max(4000).optional(), reason: z.string().max(500).optional(),
  }))), { perm: "moderation.view" });
  r.get("/api/admin/moderation/actions", async (c) => (await app.db.query(
    `SELECT m.id, m.action, m.reason, m.previous_status, m.new_status, m.at, mo.username AS moderator, t.uid AS target_uid, t.username AS target
     FROM moderation_actions m JOIN users mo ON mo.id = m.moderator_id LEFT JOIN users t ON t.id = m.target_user_id ORDER BY m.id DESC LIMIT $1`, [Math.min(500, Number(c.query.limit ?? 100))])).rows, { perm: "moderation.view" });
  r.get("/api/admin/tickets", async (c) => (await app.db.query(
    `SELECT t.*, u.uid, u.username, a.username AS assigned_username, (SELECT count(*)::int FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages
     FROM support_tickets t JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assigned_to
     WHERE ($1::text IS NULL OR t.status = $1) AND ($2::boolean IS NULL OR t.assigned_to = $3) ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, t.updated_at DESC LIMIT 200`,
    [c.query.status ?? null, c.query.mine === "1" ? true : null, c.user!.id])).rows, { perm: "support.view" });
  r.get("/api/admin/tickets/:id", async (c) => S.ticketThread(app, uid(c.params.id), { userId: c.user!.id, staff: true }), { perm: "support.view" });
  r.post("/api/admin/tickets/:id/messages", async (c) => { const b = await c.body(z.object({ body: z.string().trim().min(1).max(8000), internal: z.boolean().default(false) })); await S.replyTicket(app, uid(c.params.id), { userId: c.user!.id, staff: true, ctx: c }, b.body, b.internal); }, { perm: "support.manage" });
  r.patch("/api/admin/tickets/:id", async (c) => S.updateTicket(app, c, c.user!.id, uid(c.params.id), await c.body(z.object({ status: z.enum(["open", "awaiting_staff", "awaiting_user", "escalated", "closed"]).optional(), priority: z.enum(["low", "normal", "high", "urgent"]).optional(), assignToMe: z.boolean().optional() }))), { perm: "support.manage" });

  // ------------------------------------------------------------ monetization
  r.get("/api/admin/products", async () => $.listProducts(app), { perm: "payments.view" });
  r.patch("/api/admin/products/:key", async (c) => $.updateProduct(app, c, c.params.key, await c.body(z.object({ name: z.string().max(60).optional(), description: z.string().max(300).optional(), priceCents: z.number().int().min(50).max(100000).optional(), currency: z.string().regex(/^[a-z]{3}$/).optional(), enabled: z.boolean().optional() }))), { perm: "premium.manage" });
  r.put("/api/admin/premium/enabled", async (c) => { const b = await c.body(z.object({ enabled: z.boolean(), reason: z.string().max(500).optional() })); return setSetting(app, actorOf(c), "premium.enabled", b.enabled, true, b.reason); }, { perm: "premium.manage" });
  r.get("/api/admin/purchases", async (c) => (await app.db.query(
    `SELECT p.*, u.uid, u.username, (SELECT COALESCE(sum(amount_cents),0)::int FROM refunds r WHERE r.purchase_id = p.id) AS refunded_cents FROM purchases p JOIN users u ON u.id = p.user_id
     WHERE ($1::text IS NULL OR p.status = $1) AND ($2::text IS NULL OR p.product_key = $2) ORDER BY p.created_at DESC LIMIT 200`, [c.query.status ?? null, c.query.product ?? null])).rows, { perm: "payments.view" });
  r.get("/api/admin/transactions", async () => (await app.db.query("SELECT pay.*, p.product_key, u.username FROM payments pay LEFT JOIN purchases p ON p.id = pay.purchase_id LEFT JOIN users u ON u.id = p.user_id ORDER BY pay.at DESC LIMIT 200")).rows, { perm: "payments.view" });
  r.get("/api/admin/refunds", async () => (await app.db.query("SELECT r.*, p.product_key, u.username, a.username AS requested_by_username FROM refunds r JOIN purchases p ON p.id = r.purchase_id JOIN users u ON u.id = p.user_id LEFT JOIN users a ON a.id = r.requested_by ORDER BY r.at DESC LIMIT 200")).rows, { perm: "payments.view" });
  r.get("/api/admin/subscriptions", async () => (await app.db.query("SELECT s.*, u.uid, u.username FROM subscriptions s JOIN users u ON u.id = s.user_id ORDER BY s.updated_at DESC LIMIT 200")).rows, { perm: "payments.view" });
  r.get("/api/admin/premium-users", async () => (await app.db.query(
    `SELECT e.id, e.source, e.starts_at, e.expires_at, e.reason, u.uid, u.username, g.username AS granted_by FROM entitlements e JOIN users u ON u.id = e.user_id LEFT JOIN users g ON g.id = e.granted_by
     WHERE e.kind = $1 AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now()) ORDER BY e.created_at DESC`, ["premium"])).rows, { perm: "premium.view" });
  r.get("/api/admin/verified-users", async () => (await app.db.query(
    `SELECT e.source, e.created_at, e.reason, u.uid, u.username, g.username AS granted_by FROM entitlements e JOIN users u ON u.id = e.user_id LEFT JOIN users g ON g.id = e.granted_by
     WHERE e.kind = 'verified' AND e.revoked_at IS NULL ORDER BY e.created_at DESC`)).rows, { perm: "premium.view" });
  r.get("/api/admin/credits", async () => (await app.db.query("SELECT u.uid, u.username, c.balance FROM badge_credits c JOIN users u ON u.id = c.user_id WHERE c.balance > 0 ORDER BY c.balance DESC LIMIT 200")).rows, { perm: "premium.view" });
  r.post("/api/admin/purchases/:id/refund", async (c) => { const b = await c.body(z.object({ amountCents: z.number().int().positive().nullable().default(null), reason })); return $.refund(app, c, uid(c.params.id), b.amountCents, b.reason); }, { perm: "payments.refund" });

  // ------------------------------------------------------------ announcements
  const ann = z.object({ title: z.string().trim().min(1).max(100), body: z.string().trim().min(1).max(2000), level: z.enum(["info", "success", "warning", "critical"]).default("info"), published: z.boolean().default(false), startsAt: z.coerce.date().nullable().default(null), endsAt: z.coerce.date().nullable().default(null) });
  r.get("/api/admin/announcements", async () => (await app.db.query("SELECT a.*, u.username AS author FROM announcements a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.created_at DESC")).rows, { perm: "announcements.manage" });
  r.post("/api/admin/announcements", async (c) => {
    const b = await c.body(ann);
    const x = (await app.db.query("INSERT INTO announcements (title, body, level, published, starts_at, ends_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", [b.title, b.body, b.level, b.published, b.startsAt, b.endsAt, c.user!.id])).rows[0];
    await audit(app.db, actorOf(c), { action: "announcement.created", targetType: "announcement", targetId: x.id, next: b });
    return x;
  }, { perm: "announcements.manage" });
  r.patch("/api/admin/announcements/:id", async (c) => {
    const b = await c.body(ann.partial());
    const x = (await app.db.query(`UPDATE announcements SET title = COALESCE($2,title), body = COALESCE($3,body), level = COALESCE($4,level), published = COALESCE($5,published),
      starts_at = CASE WHEN $6 THEN $7::timestamptz ELSE starts_at END, ends_at = CASE WHEN $8 THEN $9::timestamptz ELSE ends_at END, updated_at = now() WHERE id = $1 RETURNING *`,
      [uid(c.params.id), b.title ?? null, b.body ?? null, b.level ?? null, b.published ?? null, b.startsAt !== undefined, b.startsAt ?? null, b.endsAt !== undefined, b.endsAt ?? null])).rows[0];
    if (!x) throw new HttpError(404, "not_found", "Announcement not found");
    await audit(app.db, actorOf(c), { action: "announcement.updated", targetType: "announcement", targetId: x.id, next: b });
    return x;
  }, { perm: "announcements.manage" });
  r.delete("/api/admin/announcements/:id", async (c) => {
    const x = await app.db.query("DELETE FROM announcements WHERE id = $1 RETURNING title", [uid(c.params.id)]);
    if (!x.rowCount) throw new HttpError(404, "not_found", "Announcement not found");
    await audit(app.db, actorOf(c), { action: "announcement.deleted", targetType: "announcement", targetId: c.params.id, previous: x.rows[0] });
  }, { perm: "announcements.manage" });

  // ------------------------------------------------------------ storage & analytics
  r.get("/api/admin/storage", async () => ({
    driver: app.storageStatus,
    totals: (await app.db.query("SELECT kind, purpose, count(*)::int AS files, COALESCE(sum(size_bytes),0)::bigint AS bytes FROM assets WHERE status = 'ready' GROUP BY kind, purpose ORDER BY bytes DESC")).rows,
    topUsers: (await app.db.query("SELECT u.uid, u.username, count(*)::int AS files, sum(a.size_bytes)::bigint AS bytes FROM assets a JOIN users u ON u.id = a.user_id WHERE a.status = 'ready' GROUP BY u.uid, u.username ORDER BY bytes DESC LIMIT 20")).rows,
    pendingDeletion: (await app.db.query("SELECT count(*)::int AS n, COALESCE(sum(size_bytes),0)::bigint AS bytes FROM assets WHERE status = 'deleted' AND storage_key NOT LIKE 'x/%'")).rows[0],
    abandonedUploads: (await app.db.query("SELECT count(*)::int AS n FROM upload_sessions WHERE completed_at IS NULL AND expires_at < now()")).rows[0].n,
    limits: { image: await getSetting(app, "uploads.max_image_mb"), video: await getSetting(app, "uploads.max_video_mb"), audio: await getSetting(app, "uploads.max_audio_mb"), free: await getSetting(app, "uploads.quota_free_mb"), premium: await getSetting(app, "uploads.quota_premium_mb") },
  }), { perm: "storage.view" });
  r.post("/api/admin/storage/cleanup", async (c) => {
    const res = await M.cleanupOrphans(app, Number(c.query.graceHours ?? 24));
    await audit(app.db, actorOf(c), { action: "storage.cleanup", targetType: "storage", next: res });
    return res;
  }, { perm: "storage.manage" });
  r.get("/api/admin/analytics", async (c) => {
    const { from, to } = range(c.query);
    const q = (sql: string) => app.db.query(sql, [from, to]).then((x) => x.rows);
    return {
      totals: (await q("SELECT kind, count(*)::int AS n, count(DISTINCT visitor_hash)::int AS uniques FROM analytics_events WHERE at BETWEEN $1 AND $2 GROUP BY kind")),
      topProfiles: await q("SELECT u.uid, u.username, count(*)::int AS views FROM analytics_events e JOIN users u ON u.id = e.user_id WHERE e.kind = 'view' AND e.at BETWEEN $1 AND $2 GROUP BY u.uid, u.username ORDER BY views DESC LIMIT 20"),
      devices: await q("SELECT device AS name, count(*)::int AS n FROM analytics_events WHERE kind = 'view' AND at BETWEEN $1 AND $2 GROUP BY 1 ORDER BY n DESC"),
      referrers: await q("SELECT COALESCE(referrer_host,'direct') AS name, count(*)::int AS n FROM analytics_events WHERE kind = 'view' AND at BETWEEN $1 AND $2 GROUP BY 1 ORDER BY n DESC LIMIT 15"),
    };
  }, { perm: "analytics.view" });
}
