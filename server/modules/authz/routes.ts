/**
 * Phase 1 admin APIs: identity, staff & permission management, settings,
 * feature flags and audit log. Every route declares its permission; the
 * router refuses to register an /api/admin route without one.
 */
import type { App } from "../../app.ts";
import { Router, z } from "../../lib/http.ts";
import { PERMISSIONS, OWNER_ONLY, ROLE_DEFAULTS, Permission } from "./registry.ts";
import * as authz from "./service.ts";
import { listSettings, setSetting, audit, verifyAuditChain, clearSettingsCache } from "../platform/service.ts";
import { HttpError } from "../../lib/errors.ts";
import { asJson } from "../../db/pg.ts";

const permKey = z.string().refine((k) => k in PERMISSIONS, "Unknown permission") as unknown as z.ZodType<Permission>;
const reason = z.string().trim().max(500).optional();

export function adminRoutes(app: App, r: Router) {
  // Any active admin elevation; the cheapest permission every role holds.
  r.get("/api/admin/whoami", async (c) => ({
    role: c.admin!.role, discordId: c.admin!.discordId, uid: c.admin!.uid,
    permissions: [...c.admin!.permissions].sort(),
  }), { perm: [] as unknown as Permission[] });

  r.post("/api/admin/session/end", async (c) => {
    await app.db.query("UPDATE admin_sessions SET revoked_at = now() WHERE id = $1", [c.admin!.adminSessionId]);
    await audit(app.db, authz.actorOf(c), { action: "admin.session_ended", targetType: "admin_session", targetId: c.admin!.adminSessionId });
  }, { perm: [] as unknown as Permission[] });

  r.get("/api/admin/permissions", async () => {
    const roles = (await app.db.query("SELECT role, permission FROM role_permissions ORDER BY role, permission")).rows;
    return {
      registry: Object.entries(PERMISSIONS).map(([key, [category, description]]) => ({ key, category, description, ownerOnly: OWNER_ONLY.includes(key as Permission) })),
      roleDefaults: {
        ADMIN: roles.filter((x) => x.role === "ADMIN").map((x) => x.permission),
        STAFF: roles.filter((x) => x.role === "STAFF").map((x) => x.permission),
      },
      shippedDefaults: ROLE_DEFAULTS,
    };
  }, { perm: "staff.view" });

  r.put("/api/admin/permissions/roles/:role/:permission", async (c) => {
    const role = z.enum(["ADMIN", "STAFF"]).parse(c.params.role);
    const b = await c.body(z.object({ enabled: z.boolean() }));
    await authz.setRoleDefault(app, c, role, permKey.parse(c.params.permission), b.enabled);
  }, { perm: "permissions.manage" });

  // ------------------------------------------------------------ staff
  r.get("/api/admin/staff", async () => authz.listStaff(app), { perm: "staff.view" });

  r.post("/api/admin/staff", async (c) => {
    const b = await c.body(z.object({ discordId: z.string().trim(), role: z.enum(["ADMIN", "STAFF"]), note: z.string().max(200).optional() }));
    return authz.addStaff(app, c, b);
  }, { perm: "staff.manage" });

  r.patch("/api/admin/staff/:id", async (c) => {
    const b = await c.body(z.object({ role: z.enum(["ADMIN", "STAFF"]).optional(), active: z.boolean().optional(), note: z.string().max(200).nullable().optional(), reason }));
    return authz.updateStaff(app, c, z.string().uuid().parse(c.params.id), b, b.reason);
  }, { perm: "staff.manage" });

  r.delete("/api/admin/staff/:id", async (c) => {
    const b = await c.body(z.object({ reason }));
    await authz.removeStaff(app, c, z.string().uuid().parse(c.params.id), b.reason);
  }, { perm: "staff.manage" });

  r.put("/api/admin/staff/:id/permissions/:permission", async (c) => {
    const b = await c.body(z.object({ state: z.enum(["grant", "revoke", "default"]), reason }));
    return authz.setOverride(app, c, z.string().uuid().parse(c.params.id), permKey.parse(c.params.permission), b.state, b.reason);
  }, { perm: "permissions.manage" });

  r.get("/api/admin/staff/:id/activity", async (c) => {
    const s = (await app.db.query("SELECT discord_id FROM staff_authorizations WHERE id = $1", [c.params.id])).rows[0];
    if (!s) throw new HttpError(404, "not_found", "Staff record not found");
    return (await app.db.query(
      "SELECT id, action, target_type, target_id, target_uid, target_username, reason, at FROM admin_audit_log WHERE actor_discord_id = $1 ORDER BY id DESC LIMIT 200",
      [s.discord_id])).rows;
  }, { perm: ["staff.view", "audit.view"] });

  // ------------------------------------------------------------ settings & flags
  r.get("/api/admin/settings", async () => listSettings(app), { perm: "settings.view" });

  r.put("/api/admin/settings/:key", async (c) => {
    const b = await c.body(z.object({ value: z.union([z.string().max(2000), z.number(), z.boolean()]), reason }));
    return setSetting(app, authz.actorOf(c), c.params.key, b.value, c.can("settings.edit_protected"), b.reason);
  }, { perm: "settings.edit" });

  r.get("/api/admin/flags", async () => (await app.db.query("SELECT * FROM feature_flags ORDER BY key")).rows, { perm: "settings.view" });

  r.patch("/api/admin/flags/:key", async (c) => {
    const b = await c.body(z.object({ enabled: z.boolean().optional(), rolloutPercent: z.number().int().min(0).max(100).optional(), staffOnly: z.boolean().optional(), reason }));
    return app.db.tx(async (tx) => {
      const cur = (await tx.query("SELECT * FROM feature_flags WHERE key = $1 FOR UPDATE", [c.params.key])).rows[0];
      if (!cur) throw new HttpError(404, "not_found", "Unknown flag");
      const next = (await tx.query(
        `UPDATE feature_flags SET enabled = COALESCE($2, enabled), rollout_percent = COALESCE($3, rollout_percent), staff_only = COALESCE($4, staff_only),
           updated_by = $5, updated_at = now() WHERE key = $1 RETURNING *`,
        [c.params.key, b.enabled ?? null, b.rolloutPercent ?? null, b.staffOnly ?? null, c.user!.id])).rows[0];
      await audit(tx, authz.actorOf(c), { action: "flag.changed", targetType: "flag", targetId: c.params.key,
        previous: { enabled: cur.enabled, rollout: cur.rollout_percent, staffOnly: cur.staff_only },
        next: { enabled: next.enabled, rollout: next.rollout_percent, staffOnly: next.staff_only }, reason: b.reason });
      clearSettingsCache();
      return next;
    });
  }, { perm: "flags.manage" });

  // ------------------------------------------------------------ audit
  const auditQuery = z.object({
    action: z.string().max(80).optional(), actor: z.string().uuid().optional(), target: z.string().uuid().optional(),
    targetUid: z.coerce.number().int().positive().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(),
    before: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(500).default(100),
  });

  const searchAudit = async (q: z.infer<typeof auditQuery>) => (await app.db.query(
    `SELECT a.id, a.action, a.actor_user_id, a.actor_uid, a.actor_discord_id, a.actor_role, au.username AS actor_username,
            a.target_user_id, a.target_uid, a.target_username, a.target_type, a.target_id, a.previous_state, a.new_state,
            a.reason, a.ip::text, a.request_id, a.at, encode(a.hash, 'hex') AS hash
     FROM admin_audit_log a LEFT JOIN users au ON au.id = a.actor_user_id
     WHERE ($1::text IS NULL OR a.action LIKE $1 || '%')
       AND ($2::uuid IS NULL OR a.actor_user_id = $2) AND ($3::uuid IS NULL OR a.target_user_id = $3)
       AND ($4::bigint IS NULL OR a.target_uid = $4)
       AND ($5::timestamptz IS NULL OR a.at >= $5) AND ($6::timestamptz IS NULL OR a.at <= $6)
       AND ($7::bigint IS NULL OR a.id < $7)
     ORDER BY a.id DESC LIMIT $8`,
    [q.action ?? null, q.actor ?? null, q.target ?? null, q.targetUid ?? null, q.from ?? null, q.to ?? null, q.before ?? null, q.limit])).rows;

  r.get("/api/admin/audit", async (c) => {
    const rows = await searchAudit(auditQuery.parse(c.query));
    return { rows, nextBefore: rows.length ? rows[rows.length - 1].id : null };
  }, { perm: "audit.view" });

  r.get("/api/admin/audit/verify", async () => {
    const broken = await verifyAuditChain(app.db);
    return { intact: broken === null, firstBrokenId: broken };
  }, { perm: "audit.view" });

  r.get("/api/admin/audit/export", async (c) => {
    const rows = await searchAudit({ ...auditQuery.parse(c.query), limit: 500 });
    const cols = ["id", "at", "action", "actor_uid", "actor_username", "actor_role", "target_uid", "target_username", "target_type", "target_id", "reason", "ip"];
    const esc = (v: unknown) => {
      const s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // neutralise spreadsheet formulas
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csv = [cols.join(","), ...rows.map((r2) => cols.map((k) => esc((r2 as any)[k])).join(","))].join("\n");
    await audit(app.db, authz.actorOf(c), { action: "audit.exported", targetType: "audit", next: { rows: rows.length, filter: c.query } });
    c.send(200, csv, "text/csv; charset=utf-8", { "Content-Disposition": `attachment; filename="lorn-audit-${Date.now()}.csv"` });
  }, { perm: "audit.export" });

  r.get("/api/admin/security/events", async (c) => {
    const limit = Math.min(200, Number(c.query.limit ?? 100));
    return (await app.db.query(
      `SELECT e.id, e.kind, e.severity, e.data, e.ip::text, e.at, u.uid, u.username FROM security_events e
       LEFT JOIN users u ON u.id = e.user_id ORDER BY e.id DESC LIMIT $1`, [limit])).rows;
  }, { perm: "security.view" });

  r.get("/api/admin/security/logins", async (c) => (await app.db.query(
    `SELECT l.id, l.method, l.success, l.failure_reason, l.suspicious, l.ip::text, l.user_agent, l.identifier, l.at, u.uid, u.username
     FROM login_history l LEFT JOIN users u ON u.id = l.user_id
     WHERE ($1::boolean IS NULL OR l.success = $1) AND ($2::boolean IS NULL OR l.suspicious = $2) ORDER BY l.id DESC LIMIT 300`,
    [c.query.success ? c.query.success === "true" : null, c.query.suspicious === "true" ? true : null])).rows, { perm: "security.view" });

  r.get("/api/admin/security/admin-sessions", async () => (await app.db.query(
    `SELECT a.id, a.discord_id, a.ip::text, a.created_at, a.expires_at, u.uid, u.username FROM admin_sessions a JOIN users u ON u.id = a.user_id
     WHERE a.revoked_at IS NULL AND a.expires_at > now() ORDER BY a.created_at DESC`)).rows, { perm: "security.view" });

  r.delete("/api/admin/security/admin-sessions/:id", async (c) => {
    const s = (await app.db.query("SELECT discord_id FROM admin_sessions WHERE id = $1", [c.params.id])).rows[0];
    if (!s) throw new HttpError(404, "not_found", "Session not found");
    if (authz.isOwnerDiscordId(app, s.discord_id) && c.admin!.role !== "OWNER") throw new HttpError(403, "forbidden", "The owner's sessions cannot be revoked");
    await app.db.query("UPDATE admin_sessions SET revoked_at = now() WHERE id = $1", [c.params.id]);
    await audit(app.db, authz.actorOf(c), { action: "admin.session_revoked", targetType: "admin_session", targetId: c.params.id, next: { discordId: s.discord_id } });
  }, { perm: "sessions.manage" });
}

export { asJson };
