/**
 * Administrative authorization.
 *
 * - OWNER is computed from LORN_OWNER_DISCORD_ID vs the Discord ID verified
 *   through OAuth. It is never stored, so no database edit can remove it.
 * - ADMIN / STAFF come from staff_authorizations keyed by Discord ID.
 * - Effective permissions = role defaults ± per-staff overrides, minus
 *   owner-only permissions for everyone but the owner.
 * - Access needs an admin session created by a fresh Discord OAuth round-trip.
 */
import type { App, Queryable } from "../../app.ts";
import type { AdminPrincipal, Ctx } from "../../lib/http.ts";
import { ALL_PERMISSIONS, OWNER_ONLY, PERMISSIONS, Permission, ROLE_DEFAULTS } from "./registry.ts";
import { HttpError, conflict, forbidden, notFound } from "../../lib/errors.ts";
import { audit, AuditActor, getSetting } from "../platform/service.ts";

export type Role = "OWNER" | "ADMIN" | "STAFF";

/** Sync the code registry into the DB; seed role defaults on first boot. */
export async function syncPermissionRegistry(app: App) {
  await app.db.tx(async (tx) => {
    for (const [key, [category, description]] of Object.entries(PERMISSIONS)) {
      await tx.query(
        `INSERT INTO permissions (key, category, description, owner_only) VALUES ($1,$2,$3,$4)
         ON CONFLICT (key) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description, owner_only = EXCLUDED.owner_only`,
        [key, category, description, OWNER_ONLY.includes(key as Permission)],
      );
    }
    await tx.query("DELETE FROM permissions WHERE NOT (key = ANY($1::text[]))", [ALL_PERMISSIONS]);
    const seeded = await tx.query("SELECT 1 FROM role_permissions LIMIT 1");
    if (!seeded.rowCount) {
      for (const role of ["ADMIN", "STAFF"] as const) {
        for (const p of ROLE_DEFAULTS[role]) await tx.query("INSERT INTO role_permissions (role, permission) VALUES ($1,$2)", [role, p]);
      }
    }
  });
}

export function isOwnerDiscordId(app: App, discordId: string | null | undefined) {
  return !!discordId && !!app.cfg.ownerDiscordId && discordId === app.cfg.ownerDiscordId;
}

export async function discordIdOf(db: Queryable, userId: string): Promise<string | null> {
  return (await db.query("SELECT provider_user_id FROM oauth_accounts WHERE user_id = $1 AND provider = 'discord'", [userId])).rows[0]?.provider_user_id ?? null;
}

export async function isOwnerUser(app: App, userId: string) {
  return isOwnerDiscordId(app, await discordIdOf(app.db, userId));
}

/** Role for a Discord ID, owner first. Null = no administrative access. */
export async function roleForDiscordId(app: App, db: Queryable, discordId: string): Promise<{ role: Role; staffId: string | null } | null> {
  if (isOwnerDiscordId(app, discordId)) return { role: "OWNER", staffId: null };
  const s = (await db.query("SELECT id, role FROM staff_authorizations WHERE discord_id = $1 AND active", [discordId])).rows[0];
  return s ? { role: s.role, staffId: s.id } : null;
}

export async function permissionsFor(db: Queryable, role: Role, staffId: string | null): Promise<Set<Permission>> {
  if (role === "OWNER") return new Set(ALL_PERMISSIONS);
  const base = (await db.query<{ permission: Permission }>("SELECT permission FROM role_permissions WHERE role = $1", [role])).rows.map((r) => r.permission);
  const set = new Set<Permission>(base);
  if (staffId) {
    const ov = (await db.query<{ permission: Permission; granted: boolean }>("SELECT permission, granted FROM staff_permission_overrides WHERE staff_id = $1", [staffId])).rows;
    for (const o of ov) o.granted ? set.add(o.permission) : set.delete(o.permission);
  }
  for (const p of OWNER_ONLY) set.delete(p);
  return set;
}

// Cache of computed permission sets, invalidated by the DB epoch counter.
const permCache = new Map<string, { epoch: number; role: Role; staffId: string | null; perms: Set<Permission> }>();

/** Request hook: attach c.admin if this session holds a valid admin elevation. */
export async function resolveAdmin(app: App, c: Ctx) {
  if (!c.session || !c.user || c.session.mfaPending) return;
  const r = (await app.db.query(
    `SELECT a.id, a.discord_id, (SELECT epoch FROM authz_epoch) AS epoch,
            (SELECT provider_user_id FROM oauth_accounts o WHERE o.user_id = a.user_id AND o.provider = 'discord') AS linked
     FROM admin_sessions a
     WHERE a.session_id = $1 AND a.user_id = $2 AND a.revoked_at IS NULL AND a.expires_at > now()
     ORDER BY a.created_at DESC LIMIT 1`, [c.session.id, c.user.id])).rows[0];
  // Elevation is void if the Discord link changed since it was granted.
  if (!r || r.linked !== r.discord_id) return;

  const key = r.discord_id as string;
  let entry = permCache.get(key);
  if (!entry || entry.epoch !== Number(r.epoch)) {
    const role = await roleForDiscordId(app, app.db, key);
    if (!role) { permCache.delete(key); return; }
    entry = { epoch: Number(r.epoch), role: role.role, staffId: role.staffId, perms: await permissionsFor(app.db, role.role, role.staffId) };
    permCache.set(key, entry);
  }
  c.admin = {
    userId: c.user.id, uid: c.user.uid, discordId: key, role: entry.role, staffId: entry.staffId,
    permissions: entry.perms, adminSessionId: r.id,
  } satisfies AdminPrincipal;
  if (entry.staffId) {
    app.db.query("UPDATE staff_authorizations SET last_activity_at = now() WHERE id = $1 AND (last_activity_at IS NULL OR last_activity_at < now() - interval '1 minute')", [entry.staffId]).catch(() => {});
  }
}

export function actorOf(c: Ctx): AuditActor {
  return {
    userId: c.user?.id ?? null, uid: c.user?.uid ?? null, discordId: c.admin?.discordId ?? null, role: c.admin?.role ?? null,
    ip: c.ip, userAgent: c.ua, requestId: c.requestId,
  };
}

export async function createAdminSession(app: App, db: Queryable, sessionId: string, userId: string, discordId: string, ip: string) {
  const hours = await getSetting<number>(app, "security.admin_session_hours", 12);
  const r = await db.query<{ id: string }>(
    "INSERT INTO admin_sessions (session_id, user_id, discord_id, ip, expires_at) VALUES ($1,$2,$3,$4, now() + make_interval(hours => $5)) RETURNING id",
    [sessionId, userId, discordId, ip, hours]);
  return r.rows[0].id;
}

// ------------------------------------------------------------------ staff management

const SNOWFLAKE = /^\d{17,20}$/;

async function staffRow(db: Queryable, id: string) {
  const s = (await db.query("SELECT * FROM staff_authorizations WHERE id = $1", [id])).rows[0];
  if (!s) throw notFound("Staff record not found");
  return s;
}

/** Guards shared by every staff mutation. */
function guardStaffChange(c: Ctx, app: App, target: { discord_id: string; role: string }, newRole?: string) {
  const me = c.admin!;
  if (isOwnerDiscordId(app, target.discord_id)) throw forbidden("The platform owner cannot be modified");
  if (target.discord_id === me.discordId) throw forbidden("You cannot change your own authorization");
  const touchesAdmin = target.role === "ADMIN" || newRole === "ADMIN";
  if (touchesAdmin && !me.permissions.has("admins.manage")) throw forbidden("Only the owner can manage administrators");
  if (!me.permissions.has("staff.manage")) throw forbidden();
}

export async function listStaff(app: App) {
  const rows = (await app.db.query(
    `SELECT s.id, s.discord_id, s.role, s.active, s.note, s.added_at, s.updated_at, s.last_activity_at,
            u.uid AS linked_uid, u.username AS linked_username, ab.username AS added_by_username,
            COALESCE((SELECT json_agg(json_build_object('permission', o.permission, 'granted', o.granted)) FROM staff_permission_overrides o WHERE o.staff_id = s.id), '[]') AS overrides
     FROM staff_authorizations s
     LEFT JOIN oauth_accounts oa ON oa.provider = 'discord' AND oa.provider_user_id = s.discord_id
     LEFT JOIN users u ON u.id = oa.user_id AND u.deleted_at IS NULL
     LEFT JOIN users ab ON ab.id = s.added_by
     ORDER BY s.role, s.added_at`)).rows;
  const owner = app.cfg.ownerDiscordId ? (await app.db.query(
    `SELECT u.uid, u.username FROM oauth_accounts oa JOIN users u ON u.id = oa.user_id
     WHERE oa.provider = 'discord' AND oa.provider_user_id = $1 AND u.deleted_at IS NULL`, [app.cfg.ownerDiscordId])).rows[0] : null;
  const effective = [];
  for (const r of rows) effective.push({ ...r, effectivePermissions: [...(await permissionsFor(app.db, r.role, r.id))].sort() });
  return {
    owner: app.cfg.ownerDiscordId ? { discordId: app.cfg.ownerDiscordId, linkedUid: owner?.uid ?? null, linkedUsername: owner?.username ?? null } : null,
    staff: effective,
  };
}

export async function addStaff(app: App, c: Ctx, input: { discordId: string; role: "ADMIN" | "STAFF"; note?: string }) {
  if (!SNOWFLAKE.test(input.discordId)) throw new HttpError(422, "validation_failed", "Discord ID must be a 17–20 digit number");
  guardStaffChange(c, app, { discord_id: input.discordId, role: input.role });
  return app.db.tx(async (tx) => {
    const existing = (await tx.query("SELECT id FROM staff_authorizations WHERE discord_id = $1", [input.discordId])).rows[0];
    if (existing) throw conflict("This Discord ID is already authorized");
    const r = (await tx.query(
      "INSERT INTO staff_authorizations (discord_id, role, note, added_by) VALUES ($1,$2,$3,$4) RETURNING *",
      [input.discordId, input.role, input.note ?? null, c.user!.id])).rows[0];
    await audit(tx, actorOf(c), { action: "staff.added", targetType: "staff", targetId: r.id, next: { discordId: r.discord_id, role: r.role } });
    return r;
  });
}

export async function updateStaff(app: App, c: Ctx, id: string, patch: { role?: "ADMIN" | "STAFF"; active?: boolean; note?: string | null }, reason?: string) {
  return app.db.tx(async (tx) => {
    const cur = await staffRow(tx, id);
    guardStaffChange(c, app, cur, patch.role);
    const next = { role: patch.role ?? cur.role, active: patch.active ?? cur.active, note: patch.note === undefined ? cur.note : patch.note };
    await tx.query("UPDATE staff_authorizations SET role = $2, active = $3, note = $4, updated_at = now() WHERE id = $1", [id, next.role, next.active, next.note]);
    if (!next.active || next.role !== cur.role) {
      // Drop live admin elevations for this Discord ID so access ends now.
      await tx.query("UPDATE admin_sessions SET revoked_at = now() WHERE discord_id = $1 AND revoked_at IS NULL", [cur.discord_id]);
    }
    const action = patch.active === false ? "staff.suspended" : patch.active === true && !cur.active ? "staff.reactivated" : patch.role && patch.role !== cur.role ? "staff.role_changed" : "staff.updated";
    await audit(tx, actorOf(c), { action, targetType: "staff", targetId: id, previous: { role: cur.role, active: cur.active, note: cur.note }, next, reason });
    return { id, ...next };
  });
}

export async function removeStaff(app: App, c: Ctx, id: string, reason?: string) {
  return app.db.tx(async (tx) => {
    const cur = await staffRow(tx, id);
    guardStaffChange(c, app, cur);
    await tx.query("UPDATE admin_sessions SET revoked_at = now() WHERE discord_id = $1 AND revoked_at IS NULL", [cur.discord_id]);
    await tx.query("DELETE FROM staff_authorizations WHERE id = $1", [id]);
    await audit(tx, actorOf(c), { action: "staff.removed", targetType: "staff", targetId: id, previous: { discordId: cur.discord_id, role: cur.role }, reason });
  });
}

export async function setOverride(app: App, c: Ctx, staffId: string, permission: Permission, state: "grant" | "revoke" | "default", reason?: string) {
  if (!c.admin!.permissions.has("permissions.manage")) throw forbidden("Only the owner can change individual permissions");
  if (!(permission in PERMISSIONS)) throw notFound("Unknown permission");
  if (OWNER_ONLY.includes(permission) && state === "grant") throw forbidden("This permission is reserved for the owner");
  return app.db.tx(async (tx) => {
    const cur = await staffRow(tx, staffId);
    if (isOwnerDiscordId(app, cur.discord_id)) throw forbidden("The platform owner cannot be modified");
    if (cur.discord_id === c.admin!.discordId) throw forbidden("You cannot change your own permissions");
    const prev = (await tx.query("SELECT granted FROM staff_permission_overrides WHERE staff_id = $1 AND permission = $2", [staffId, permission])).rows[0];
    if (state === "default") {
      await tx.query("DELETE FROM staff_permission_overrides WHERE staff_id = $1 AND permission = $2", [staffId, permission]);
    } else {
      await tx.query(
        `INSERT INTO staff_permission_overrides (staff_id, permission, granted, set_by) VALUES ($1,$2,$3,$4)
         ON CONFLICT (staff_id, permission) DO UPDATE SET granted = EXCLUDED.granted, set_by = EXCLUDED.set_by, set_at = now()`,
        [staffId, permission, state === "grant", c.user!.id]);
    }
    await audit(tx, actorOf(c), {
      action: "staff.permission_changed", targetType: "staff", targetId: staffId,
      previous: { permission, override: prev ? (prev.granted ? "grant" : "revoke") : "default" }, next: { permission, override: state }, reason,
    });
    return { effectivePermissions: [...(await permissionsFor(tx, cur.role, staffId))].sort() };
  });
}

export async function setRoleDefault(app: App, c: Ctx, role: "ADMIN" | "STAFF", permission: Permission, enabled: boolean) {
  if (!c.admin!.permissions.has("permissions.manage")) throw forbidden("Only the owner can change role defaults");
  if (OWNER_ONLY.includes(permission) && enabled) throw forbidden("This permission is reserved for the owner");
  await app.db.tx(async (tx) => {
    if (enabled) await tx.query("INSERT INTO role_permissions (role, permission) VALUES ($1,$2) ON CONFLICT DO NOTHING", [role, permission]);
    else await tx.query("DELETE FROM role_permissions WHERE role = $1 AND permission = $2", [role, permission]);
    await audit(tx, actorOf(c), { action: "role.permission_changed", targetType: "role", targetId: role, next: { permission, enabled } });
  });
}
