/**
 * Administration: user management, moderation, reports, support tickets,
 * announcements and platform statistics. Every mutation runs in a transaction
 * with an audit record; owner protections are checked on every user action.
 */
import type { App } from "../../app.ts";
import type { Ctx } from "../../lib/http.ts";
import { asJson } from "../../db/pg.ts";
import { HttpError, badRequest, conflict, forbidden, notFound } from "../../lib/errors.ts";
import { audit, notify, queueEmail, securityEvent } from "../platform/service.ts";
import { actorOf, isOwnerUser, discordIdOf, roleForDiscordId } from "../authz/service.ts";
import { checkUsername, deleteAccount, requestPasswordReset, revokeAllSessions } from "../auth/service.ts";
import { invalidateProfileCache } from "../profiles/service.ts";
import { activeEntitlements } from "../monetization/entitlements.ts";
import { PgError } from "../../db/pg.ts";

async function target(app: App, c: Ctx, userId: string, opts: { allowSelf?: boolean } = {}) {
  const u = (await app.db.query("SELECT id, uid, username, email, status, deleted_at FROM users WHERE id = $1", [userId])).rows[0];
  if (!u) throw notFound("User not found");
  if (await isOwnerUser(app, userId) && c.admin!.role !== "OWNER") throw forbidden("The platform owner is protected");
  if (!opts.allowSelf && userId === c.user!.id) throw forbidden("You can't perform this action on your own account");
  // Staff can't act on staff of equal or higher rank.
  const d = await discordIdOf(app.db, userId);
  const r = d ? await roleForDiscordId(app, app.db, d) : null;
  const rank = { OWNER: 3, ADMIN: 2, STAFF: 1 } as const;
  if (r && c.admin!.role !== "OWNER" && rank[r.role] >= rank[c.admin!.role]) throw forbidden(`You can't take action against a ${r.role.toLowerCase()}`);
  return u;
}

const a = (c: Ctx, u: any) => ({ actor: actorOf(c), t: { targetUserId: u.id, targetUid: Number(u.uid), targetUsername: u.username } });

// ------------------------------------------------------------------ search

export async function searchUsers(app: App, c: Ctx, q: {
  q?: string; status?: string; premium?: boolean; verified?: boolean; role?: string; badge?: string; banned?: boolean; locked?: boolean;
  from?: Date; to?: Date; sort: "uid" | "-uid" | "created" | "-created" | "username" | "last_login"; limit: number; offset: number;
}) {
  const showEmail = c.can("users.view_email");
  const term = q.q?.trim() ?? null;
  const order = { uid: "u.uid ASC", "-uid": "u.uid DESC", created: "u.created_at ASC", "-created": "u.created_at DESC", username: "u.username_lc ASC", last_login: "u.last_login_at DESC NULLS LAST" }[q.sort];
  const r = await app.db.query(
    `SELECT u.id, u.uid, u.username, u.email, u.status, u.created_at, u.last_login_at, u.email_verified_at IS NOT NULL AS email_verified,
       d.provider_user_id AS discord_id, count(*) OVER() AS total,
       EXISTS (SELECT 1 FROM account_bans b WHERE b.user_id = u.id AND b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now())) AS banned,
       EXISTS (SELECT 1 FROM account_locks l WHERE l.user_id = u.id AND l.unlocked_at IS NULL) AS locked,
       EXISTS (SELECT 1 FROM entitlements e WHERE e.user_id = u.id AND e.kind = 'premium' AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())) AS premium,
       EXISTS (SELECT 1 FROM entitlements e WHERE e.user_id = u.id AND e.kind = 'verified' AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())) AS verified,
       s.role AS staff_role
     FROM users u
     LEFT JOIN oauth_accounts d ON d.user_id = u.id AND d.provider = 'discord'
     LEFT JOIN staff_authorizations s ON s.discord_id = d.provider_user_id AND s.active
     WHERE ($1::text IS NULL OR u.username_lc LIKE lower($1) || '%' OR u.uid::text = $1 OR d.provider_user_id = $1 OR ($2 AND u.email = $1))
       AND ($3::text IS NULL OR u.status = $3)
       AND ($4::boolean IS NULL OR EXISTS (SELECT 1 FROM entitlements e WHERE e.user_id = u.id AND e.kind = 'premium' AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())) = $4)
       AND ($5::boolean IS NULL OR EXISTS (SELECT 1 FROM entitlements e WHERE e.user_id = u.id AND e.kind = 'verified' AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())) = $5)
       AND ($6::text IS NULL OR s.role = $6 OR ($6 = 'OWNER' AND d.provider_user_id = $13))
       AND ($7::text IS NULL OR EXISTS (SELECT 1 FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = u.id AND b.key = $7))
       AND ($8::boolean IS NULL OR EXISTS (SELECT 1 FROM account_bans b WHERE b.user_id = u.id AND b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now())) = $8)
       AND ($9::boolean IS NULL OR EXISTS (SELECT 1 FROM account_locks l WHERE l.user_id = u.id AND l.unlocked_at IS NULL) = $9)
       AND ($10::timestamptz IS NULL OR u.created_at >= $10) AND ($11::timestamptz IS NULL OR u.created_at <= $11)
     ORDER BY ${order} LIMIT $12 OFFSET $14`,
    [term, showEmail, q.status ?? null, q.premium ?? null, q.verified ?? null, q.role ?? null, q.badge ?? null, q.banned ?? null, q.locked ?? null,
     q.from ?? null, q.to ?? null, q.limit, app.cfg.ownerDiscordId ?? "", q.offset]);
  return {
    total: Number(r.rows[0]?.total ?? 0),
    items: r.rows.map(({ total, ...u }) => ({ ...u, email: showEmail ? u.email : null, staff_role: u.discord_id && u.discord_id === app.cfg.ownerDiscordId ? "OWNER" : u.staff_role })),
  };
}

export async function inspectUser(app: App, c: Ctx, userId: string) {
  const u = (await app.db.query(
    `SELECT u.id, u.uid, u.username, u.display_name, u.email, u.email_verified_at, u.status, u.created_at, u.last_login_at, u.deleted_at, u.totp_enabled_at IS NOT NULL AS two_factor,
       u.locked_until, p.is_published, p.moderation_hidden, p.moderation_reason, p.view_count, p.published_at, v.config AS published
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN profile_versions v ON v.id = p.published_version_id WHERE u.id = $1`, [userId])).rows[0];
  if (!u) throw notFound("User not found");
  const q = (sql: string) => app.db.query(sql, [userId]).then((r) => r.rows);
  const discordId = await discordIdOf(app.db, userId);
  const role = discordId ? await roleForDiscordId(app, app.db, discordId) : null;
  const [connections, badges, purchases, sessions, logins, locks, bans, events, notes, warnings, modActions, reports, clicks, media, flags, history, recoveries] = await Promise.all([
    q("SELECT provider, provider_user_id, provider_username, linked_at FROM oauth_accounts WHERE user_id = $1"),
    q("SELECT b.id, b.key, b.name, ub.method, ub.acquired_at, ub.hidden FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = $1 ORDER BY ub.acquired_at"),
    c.can("payments.view") ? q("SELECT p.id, p.product_key, p.amount_cents, p.currency, p.status, p.created_at, p.paid_at, (SELECT json_agg(r) FROM refunds r WHERE r.purchase_id = p.id) AS refunds FROM purchases p WHERE p.user_id = $1 ORDER BY p.created_at DESC") : Promise.resolve(null),
    q("SELECT id, auth_method, ip::text, user_agent, created_at, last_seen_at FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC"),
    q("SELECT method, success, failure_reason, suspicious, ip::text, at FROM login_history WHERE user_id = $1 ORDER BY at DESC LIMIT 50"),
    q("SELECT l.*, a.username AS by FROM account_locks l LEFT JOIN users a ON a.id = l.locked_by WHERE l.user_id = $1 ORDER BY locked_at DESC"),
    q("SELECT b.*, a.username AS by FROM account_bans b LEFT JOIN users a ON a.id = b.banned_by WHERE b.user_id = $1 ORDER BY banned_at DESC"),
    q("SELECT kind, severity, data, ip::text, at FROM security_events WHERE user_id = $1 ORDER BY at DESC LIMIT 50"),
    c.can("users.notes") ? q("SELECT n.id, n.body, n.at, a.username AS author FROM user_notes n JOIN users a ON a.id = n.author_id WHERE n.user_id = $1 ORDER BY n.at DESC") : Promise.resolve(null),
    q("SELECT w.reason, w.at, w.acknowledged_at, a.username AS by FROM warnings w JOIN users a ON a.id = w.issued_by WHERE w.user_id = $1 ORDER BY w.at DESC"),
    q("SELECT m.action, m.reason, m.previous_status, m.new_status, m.at, a.username AS moderator FROM moderation_actions m JOIN users a ON a.id = m.moderator_id WHERE m.target_user_id = $1 ORDER BY m.at DESC LIMIT 100"),
    q("SELECT id, category, status, created_at FROM reports WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT 50"),
    q("SELECT count(*) FILTER (WHERE kind = 'click')::int AS clicks, count(*) FILTER (WHERE kind = 'view')::int AS views FROM analytics_events WHERE user_id = $1"),
    q("SELECT count(*)::int AS files, COALESCE(sum(size_bytes),0)::bigint AS bytes FROM assets WHERE user_id = $1 AND status = 'ready'"),
    q("SELECT f.reason, f.at, f.cleared_at, a.username AS by FROM user_flags f JOIN users a ON a.id = f.flagged_by WHERE f.user_id = $1 ORDER BY f.at DESC"),
    q("SELECT old_username, new_username, reason, changed_at FROM username_history WHERE user_id = $1 ORDER BY changed_at DESC"),
    q("SELECT created_at, used_at, expires_at, created_by IS NOT NULL AS by_staff FROM auth_tokens WHERE user_id = $1 AND purpose = 'reset_password' ORDER BY created_at DESC LIMIT 20"),
  ]);
  const cfg = u.published;
  return {
    account: {
      id: u.id, uid: Number(u.uid), username: u.username, displayName: u.display_name, email: c.can("users.view_email") ? u.email : null,
      emailVerified: !!u.email_verified_at, status: u.status, createdAt: u.created_at, lastLoginAt: u.last_login_at, deletedAt: u.deleted_at,
      twoFactor: u.two_factor, discordId, role: role?.role ?? null, autoLockedUntil: u.locked_until,
    },
    profile: {
      url: `${app.cfg.appUrl}/${u.username}`, published: u.is_published, publishedAt: u.published_at, hidden: u.moderation_hidden, hiddenReason: u.moderation_reason,
      views: Number(u.view_count ?? 0), totals: clicks[0], visibility: cfg?.visibility ?? null, background: cfg ? { type: cfg.background?.type, effect: cfg.background?.effect } : null,
      links: cfg?.links?.map((l: any) => ({ platform: l.platform, url: l.url, title: l.title })) ?? [], widgets: cfg?.widgets?.map((w: any) => w.type) ?? [],
      musicTracks: cfg?.music?.tracks?.length ?? 0, media: media[0],
    },
    connections, badges, entitlements: await activeEntitlements(app.db, userId), purchases,
    security: { sessions, logins, locks, bans, events, passwordRecoveries: recoveries },
    moderation: { notes, warnings, actions: modActions, reports, flags }, usernameHistory: history,
  };
}

// ------------------------------------------------------------------ account actions

export async function changeUsername(app: App, c: Ctx, userId: string, username: string, reason: string) {
  const u = await target(app, c, userId);
  const chk = await checkUsername(app, app.db, username, userId);
  if (!chk.available) throw conflict(chk.reason!, "username_unavailable");
  const { actor, t } = a(c, u);
  try {
    await app.db.tx(async (tx) => {
      await tx.query("UPDATE users SET username = $2 WHERE id = $1", [userId, username]);
      await tx.query("INSERT INTO username_history (user_id, old_username, new_username, changed_by, reason) VALUES ($1,$2,$3,$4,$5)", [userId, u.username, username, c.user!.id, reason]);
      await audit(tx, actor, { action: "user.username_changed", ...t, previous: { username: u.username }, next: { username }, reason });
      await notify(tx, userId, "account", "Your username was changed by staff", `New username: ${username}. Reason: ${reason}`);
    });
  } catch (e) {
    if (e instanceof PgError && e.code === "23505") throw conflict("This username is taken", "username_unavailable");
    throw e;
  }
  invalidateProfileCache(app, userId);
}

export async function changeEmail(app: App, c: Ctx, userId: string, email: string, reason: string) {
  const u = await target(app, c, userId);
  try {
    await app.db.tx(async (tx) => {
      await tx.query("UPDATE users SET email = $2, email_verified_at = NULL WHERE id = $1", [userId, email]);
      const { actor, t } = a(c, u);
      await audit(tx, actor, { action: "user.email_changed", ...t, previous: { email: u.email }, next: { email }, reason });
      await securityEvent(tx, userId, "email.changed_by_staff", "warning", { by: c.user!.uid });
      if (u.email) await queueEmail(app, tx, { to: u.email, userId, template: "email_changed_notice", subject: "Your LORN.LOL email was changed", text: `Staff changed the email on your account to ${email}. Reason: ${reason}. Contact support if this is unexpected.` });
    });
  } catch (e) {
    if (e instanceof PgError && e.code === "23505") throw conflict("Another account uses this email", "email_taken");
    throw e;
  }
}

export async function initiateRecovery(app: App, c: Ctx, userId: string, reason: string) {
  const u = await target(app, c, userId);
  if (!u.email) throw badRequest("This account has no email address");
  const r = await requestPasswordReset(app, u.email, c.ip, c.user!.id);
  const { actor, t } = a(c, u);
  await audit(app.db, actor, { action: "user.password_recovery_initiated", ...t, reason });
  return r;
}

export async function lockAccount(app: App, c: Ctx, userId: string, reason: string) {
  const u = await target(app, c, userId);
  await app.db.tx(async (tx) => {
    const r = await tx.query("INSERT INTO account_locks (user_id, reason, locked_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [userId, reason, c.user!.id]);
    if (!r.rowCount) throw conflict("Account is already locked");
    await revokeAllSessions(tx, userId, "locked_by_staff");
    await modAction(tx, c, userId, "lock", reason, "active", "locked");
    const { actor, t } = a(c, u);
    await audit(tx, actor, { action: "user.locked", ...t, reason });
  });
}

export async function unlockAccount(app: App, c: Ctx, userId: string, reason: string) {
  const u = await target(app, c, userId);
  await app.db.tx(async (tx) => {
    const r = await tx.query("UPDATE account_locks SET unlocked_at = now(), unlocked_by = $2 WHERE user_id = $1 AND unlocked_at IS NULL", [userId, c.user!.id]);
    await tx.query("UPDATE users SET locked_until = NULL, failed_logins = 0 WHERE id = $1", [userId]);
    if (!r.rowCount) throw conflict("Account isn't locked");
    await modAction(tx, c, userId, "unlock", reason, "locked", "active");
    const { actor, t } = a(c, u);
    await audit(tx, actor, { action: "user.unlocked", ...t, reason });
  });
}

export async function banAccount(app: App, c: Ctx, userId: string, reason: string, expiresAt: Date | null) {
  c.require(expiresAt ? "users.ban_temporary" : "users.ban_permanent");
  if (expiresAt && expiresAt <= app.now()) throw badRequest("Ban end must be in the future");
  const u = await target(app, c, userId);
  await app.db.tx(async (tx) => {
    const r = await tx.query("INSERT INTO account_bans (user_id, reason, banned_by, expires_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [userId, reason, c.user!.id, expiresAt]);
    if (!r.rowCount) throw conflict("User is already banned");
    await revokeAllSessions(tx, userId, "banned");
    await modAction(tx, c, userId, expiresAt ? "ban_temporary" : "ban_permanent", reason, "active", "banned", { expiresAt });
    const { actor, t } = a(c, u);
    await audit(tx, actor, { action: "user.banned", ...t, next: { expiresAt }, reason });
  });
  invalidateProfileCache(app, userId);
}

export async function unban(app: App, c: Ctx, userId: string, reason: string) {
  const u = await target(app, c, userId);
  await app.db.tx(async (tx) => {
    const r = await tx.query("UPDATE account_bans SET lifted_at = now(), lifted_by = $2, lift_reason = $3 WHERE user_id = $1 AND lifted_at IS NULL", [userId, c.user!.id, reason]);
    if (!r.rowCount) throw conflict("User isn't banned");
    await modAction(tx, c, userId, "unban", reason, "banned", "active");
    const { actor, t } = a(c, u);
    await audit(tx, actor, { action: "user.unbanned", ...t, reason });
  });
  invalidateProfileCache(app, userId);
}

export async function adminDeleteAccount(app: App, c: Ctx, userId: string, reason: string, confirmUsername: string) {
  const u = await target(app, c, userId);
  if (confirmUsername.toLowerCase() !== u.username.toLowerCase()) throw badRequest("Type the username to confirm");
  await deleteAccount(app, userId, { confirmUsername, byAdmin: true });
  const { actor, t } = a(c, u);
  await audit(app.db, actor, { action: "user.deleted", ...t, previous: { username: u.username, email: u.email }, reason });
  await app.db.query("INSERT INTO moderation_actions (moderator_id, target_user_id, action, reason, previous_status, new_status) VALUES ($1,$2,'delete',$3,'active','deleted')", [c.user!.id, userId, reason]);
  invalidateProfileCache(app, userId);
}

export async function revokeUserSessions(app: App, c: Ctx, userId: string, reason: string) {
  const u = await target(app, c, userId, { allowSelf: true });
  const n = await revokeAllSessions(app.db, userId, "revoked_by_staff");
  const { actor, t } = a(c, u);
  await audit(app.db, actor, { action: "user.sessions_revoked", ...t, next: { revoked: n }, reason });
  return { revoked: n };
}

export async function addNote(app: App, c: Ctx, userId: string, body: string) {
  const u = (await app.db.query("SELECT id, uid, username FROM users WHERE id = $1", [userId])).rows[0];
  if (!u) throw notFound("User not found");
  await app.db.query("INSERT INTO user_notes (user_id, author_id, body) VALUES ($1,$2,$3)", [userId, c.user!.id, body]);
  const { actor, t } = a(c, u);
  await audit(app.db, actor, { action: "user.note_added", ...t });
}

export async function warnUser(app: App, c: Ctx, userId: string, reason: string) {
  const u = await target(app, c, userId);
  await app.db.tx(async (tx) => {
    await tx.query("INSERT INTO warnings (user_id, issued_by, reason) VALUES ($1,$2,$3)", [userId, c.user!.id, reason]);
    await modAction(tx, c, userId, "warn", reason, null, null);
    await notify(tx, userId, "moderation", "You received a warning from LORN.LOL staff", reason);
    const { actor, t } = a(c, u);
    await audit(tx, actor, { action: "user.warned", ...t, reason });
  });
}

export async function flagUser(app: App, c: Ctx, userId: string, reason: string, clear = false) {
  const u = await target(app, c, userId);
  if (clear) await app.db.query("UPDATE user_flags SET cleared_at = now(), cleared_by = $2 WHERE user_id = $1 AND cleared_at IS NULL", [userId, c.user!.id]);
  else await app.db.query("INSERT INTO user_flags (user_id, flagged_by, reason) VALUES ($1,$2,$3)", [userId, c.user!.id, reason]);
  const { actor, t } = a(c, u);
  await audit(app.db, actor, { action: clear ? "user.flag_cleared" : "user.flagged", ...t, reason });
}

export async function hideProfile(app: App, c: Ctx, userId: string, hidden: boolean, reason: string) {
  const u = await target(app, c, userId);
  await app.db.tx(async (tx) => {
    await tx.query("UPDATE profiles SET moderation_hidden = $2, moderation_reason = $3 WHERE user_id = $1", [userId, hidden, hidden ? reason : null]);
    await modAction(tx, c, userId, hidden ? "hide_profile" : "unhide_profile", reason, hidden ? "visible" : "hidden", hidden ? "hidden" : "visible");
    const { actor, t } = a(c, u);
    await audit(tx, actor, { action: hidden ? "profile.hidden" : "profile.restored", ...t, reason });
    if (hidden) await notify(tx, userId, "moderation", "Your profile was hidden by moderators", reason);
  });
  invalidateProfileCache(app, userId);
}

async function modAction(db: any, c: Ctx, userId: string, action: string, reason: string, prev: string | null, next: string | null, data: object = {}, reportId: string | null = null) {
  await db.query("INSERT INTO moderation_actions (moderator_id, target_user_id, report_id, action, reason, previous_status, new_status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [c.user!.id, userId, reportId, action, reason, prev, next, asJson(data)]);
}

// ------------------------------------------------------------------ reports

export async function createReport(app: App, reporterId: string | null, r: { targetType: string; username?: string; targetRef?: string; category: string; description: string; evidenceUrls: string[]; evidenceAssetIds: string[] }) {
  let targetUserId: string | null = null;
  if (r.username) {
    targetUserId = (await app.db.query("SELECT id FROM users WHERE username_lc = lower($1) AND deleted_at IS NULL", [r.username])).rows[0]?.id ?? null;
    if (!targetUserId) throw notFound("That user doesn't exist");
  }
  if (targetUserId && targetUserId === reporterId) throw badRequest("You can't report yourself");
  return app.db.tx(async (tx) => {
    const rep = (await tx.query("INSERT INTO reports (reporter_id, target_type, target_user_id, target_ref, category, description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status, created_at",
      [reporterId, r.targetType, targetUserId, r.targetRef ?? null, r.category, r.description])).rows[0];
    for (const url of r.evidenceUrls) await tx.query("INSERT INTO report_evidence (report_id, url) VALUES ($1,$2)", [rep.id, url]);
    for (const id of r.evidenceAssetIds) {
      const own = await tx.query("SELECT 1 FROM assets WHERE id = $1 AND user_id = $2 AND status = 'ready'", [id, reporterId]);
      if (!own.rowCount) throw notFound("Evidence file not found");
      await tx.query("INSERT INTO report_evidence (report_id, asset_id) VALUES ($1,$2)", [rep.id, id]);
    }
    return rep;
  });
}

export async function listReports(app: App, q: { status?: string; category?: string; assigned?: string; limit: number; offset: number }) {
  const r = await app.db.query(
    `SELECT r.*, t.uid AS target_uid, t.username AS target_username, rp.username AS reporter_username, asg.username AS assigned_username, count(*) OVER() AS total,
       (SELECT count(*)::int FROM reports r2 WHERE r2.target_user_id = r.target_user_id) AS target_report_count
     FROM reports r LEFT JOIN users t ON t.id = r.target_user_id LEFT JOIN users rp ON rp.id = r.reporter_id LEFT JOIN users asg ON asg.id = r.assigned_to
     WHERE ($1::text IS NULL OR r.status = $1) AND ($2::text IS NULL OR r.category = $2) AND ($3::uuid IS NULL OR r.assigned_to = $3)
     ORDER BY CASE r.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, r.created_at LIMIT $4 OFFSET $5`,
    [q.status ?? null, q.category ?? null, q.assigned ?? null, q.limit, q.offset]);
  return { total: Number(r.rows[0]?.total ?? 0), items: r.rows.map(({ total, ...x }) => x) };
}

export async function getReport(app: App, id: string) {
  const r = (await listReportsById(app, id));
  if (!r) throw notFound("Report not found");
  const evidence = (await app.db.query("SELECT e.id, e.url, e.note, a.storage_key, a.mime FROM report_evidence e LEFT JOIN assets a ON a.id = e.asset_id WHERE e.report_id = $1", [id])).rows
    .map((e) => ({ id: e.id, url: e.url ?? (e.storage_key ? app.storage.publicUrl(e.storage_key) : null), mime: e.mime, note: e.note }));
  const notes = (await app.db.query("SELECT n.body, n.at, a.username AS author FROM report_notes n JOIN users a ON a.id = n.author_id WHERE n.report_id = $1 ORDER BY n.at", [id])).rows;
  const actions = (await app.db.query("SELECT m.action, m.reason, m.previous_status, m.new_status, m.at, a.username AS moderator FROM moderation_actions m JOIN users a ON a.id = m.moderator_id WHERE m.report_id = $1 ORDER BY m.at", [id])).rows;
  return { ...r, evidence, notes, actions };
}

async function listReportsById(app: App, id: string) {
  return (await app.db.query(
    `SELECT r.*, t.uid AS target_uid, t.username AS target_username, rp.username AS reporter_username, asg.username AS assigned_username
     FROM reports r LEFT JOIN users t ON t.id = r.target_user_id LEFT JOIN users rp ON rp.id = r.reporter_id LEFT JOIN users asg ON asg.id = r.assigned_to WHERE r.id = $1`, [id])).rows[0];
}

export async function updateReport(app: App, c: Ctx, id: string, p: { status?: string; priority?: string; assignToMe?: boolean; unassign?: boolean; resolution?: string; note?: string; reason?: string }) {
  if (p.status && ["resolved", "rejected"].includes(p.status)) c.require("moderation.manage");
  return app.db.tx(async (tx) => {
    const cur = (await tx.query("SELECT * FROM reports WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!cur) throw notFound("Report not found");
    if (p.status && ["resolved", "rejected"].includes(p.status) && !(p.resolution ?? p.reason)) throw badRequest("Add a resolution or reason");
    await tx.query(
      `UPDATE reports SET status = COALESCE($2,status), priority = COALESCE($3,priority), resolution = COALESCE($4,resolution),
         assigned_to = CASE WHEN $5 THEN $6::uuid WHEN $7 THEN NULL ELSE assigned_to END, updated_at = now() WHERE id = $1`,
      [id, p.status ?? null, p.priority ?? null, p.resolution ?? null, !!p.assignToMe, c.user!.id, !!p.unassign]);
    if (p.note) await tx.query("INSERT INTO report_notes (report_id, author_id, body) VALUES ($1,$2,$3)", [id, c.user!.id, p.note]);
    if (p.status && p.status !== cur.status) {
      await tx.query("INSERT INTO moderation_actions (moderator_id, target_user_id, report_id, action, reason, previous_status, new_status) VALUES ($1,$2,$3,'report_status',$4,$5,$6)",
        [c.user!.id, cur.target_user_id, id, p.resolution ?? p.reason ?? "status change", cur.status, p.status]);
      await audit(tx, actorOf(c), { action: "report.status_changed", targetUserId: cur.target_user_id, targetType: "report", targetId: id, previous: { status: cur.status }, next: { status: p.status }, reason: p.resolution ?? p.reason });
      if (cur.reporter_id && ["resolved", "rejected"].includes(p.status)) await notify(tx, cur.reporter_id, "report", `Your report was ${p.status}`, p.resolution ?? undefined);
    }
    return (await tx.query("SELECT * FROM reports WHERE id = $1", [id])).rows[0];
  });
}

// ------------------------------------------------------------------ support

export async function createTicket(app: App, userId: string, t: { category: string; subject: string; body: string; attachmentIds: string[] }) {
  return app.db.tx(async (tx) => {
    for (const id of t.attachmentIds) {
      const own = await tx.query("SELECT 1 FROM assets WHERE id = $1 AND user_id = $2 AND status = 'ready'", [id, userId]);
      if (!own.rowCount) throw notFound("Attachment not found");
    }
    const tk = (await tx.query("INSERT INTO support_tickets (user_id, category, subject, status) VALUES ($1,$2,$3,'awaiting_staff') RETURNING *", [userId, t.category, t.subject])).rows[0];
    await tx.query("INSERT INTO ticket_messages (ticket_id, author_id, body, attachment_ids) VALUES ($1,$2,$3,$4)", [tk.id, userId, t.body, t.attachmentIds]);
    return tk;
  });
}

export async function ticketThread(app: App, id: string, viewer: { userId: string; staff: boolean }) {
  const t = (await app.db.query("SELECT t.*, u.uid, u.username, a.username AS assigned_username FROM support_tickets t JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assigned_to WHERE t.id = $1", [id])).rows[0];
  if (!t || (!viewer.staff && t.user_id !== viewer.userId)) throw notFound("Ticket not found");
  const msgs = (await app.db.query(
    `SELECT m.id, m.body, m.from_staff, m.internal, m.at, m.attachment_ids, u.username AS author FROM ticket_messages m JOIN users u ON u.id = m.author_id
     WHERE m.ticket_id = $1 AND ($2 OR NOT m.internal) ORDER BY m.at`, [id, viewer.staff])).rows;
  const ids = msgs.flatMap((m) => m.attachment_ids);
  const files = ids.length ? (await app.db.query("SELECT id, name, mime, storage_key FROM assets WHERE id = ANY($1::uuid[])", [ids])).rows : [];
  return {
    ...t, messages: msgs.map((m) => ({ ...m, attachments: m.attachment_ids.map((i: string) => files.find((f) => f.id === i)).filter(Boolean).map((f: any) => ({ id: f.id, name: f.name, mime: f.mime, url: app.storage.publicUrl(f.storage_key) })) })),
  };
}

export async function replyTicket(app: App, id: string, author: { userId: string; staff: boolean; ctx?: Ctx }, body: string, internal: boolean, attachmentIds: string[] = []) {
  return app.db.tx(async (tx) => {
    const t = (await tx.query("SELECT * FROM support_tickets WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!t || (!author.staff && t.user_id !== author.userId)) throw notFound("Ticket not found");
    if (t.status === "closed" && !author.staff) throw conflict("This ticket is closed. Open a new one.");
    for (const a2 of attachmentIds) {
      const own = await tx.query("SELECT 1 FROM assets WHERE id = $1 AND user_id = $2 AND status = 'ready'", [a2, author.userId]);
      if (!own.rowCount) throw notFound("Attachment not found");
    }
    await tx.query("INSERT INTO ticket_messages (ticket_id, author_id, from_staff, internal, body, attachment_ids) VALUES ($1,$2,$3,$4,$5,$6)", [id, author.userId, author.staff, author.staff && internal, body, attachmentIds]);
    if (!(author.staff && internal)) {
      await tx.query("UPDATE support_tickets SET status = $2, updated_at = now() WHERE id = $1", [id, author.staff ? "awaiting_user" : "awaiting_staff"]);
      if (author.staff) await notify(tx, t.user_id, "support", `Staff replied to your ticket #${t.number}`, body.slice(0, 140), { ticketId: id });
    }
  });
}

export async function updateTicket(app: App, c: Ctx | null, userId: string, id: string, p: { status?: string; priority?: string; assignToMe?: boolean }) {
  const t = (await app.db.query("SELECT * FROM support_tickets WHERE id = $1", [id])).rows[0];
  if (!t || (!c && t.user_id !== userId)) throw notFound("Ticket not found");
  if (!c && (p.priority || p.assignToMe || (p.status && p.status !== "closed"))) throw forbidden("You can only close your ticket");
  await app.db.query(
    `UPDATE support_tickets SET status = COALESCE($2,status), priority = COALESCE($3,priority), assigned_to = CASE WHEN $4 THEN $5::uuid ELSE assigned_to END,
       closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE NULL END, updated_at = now() WHERE id = $1`,
    [id, p.status ?? null, p.priority ?? null, !!p.assignToMe, userId]);
  if (c && (p.status === "escalated" || p.priority)) await audit(app.db, actorOf(c), { action: "ticket.updated", targetUserId: t.user_id, targetType: "ticket", targetId: id, previous: { status: t.status, priority: t.priority }, next: p });
}

// ------------------------------------------------------------------ dashboard stats

export async function dashboardStats(app: App, c: Ctx, from: Date, to: Date) {
  const one = (sql: string, p: unknown[] = []) => app.db.query(sql, p).then((r) => r.rows[0]);
  const all = (sql: string, p: unknown[] = []) => app.db.query(sql, p).then((r) => r.rows);
  const platform = await one(`SELECT (SELECT last FROM uid_counter)::int AS total_registrations,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL)::int AS live_accounts,
      (SELECT count(DISTINCT user_id) FROM sessions WHERE last_seen_at > now() - interval '30 days')::int AS active_users,
      (SELECT count(*) FROM users WHERE created_at >= date_trunc('day', now()))::int AS today,
      (SELECT count(*) FROM users WHERE created_at >= now() - interval '7 days')::int AS week,
      (SELECT count(*) FROM users WHERE created_at >= now() - interval '30 days')::int AS month,
      (SELECT count(*) FROM profiles p JOIN profile_versions v ON v.id = p.published_version_id WHERE p.is_published AND NOT p.moderation_hidden AND v.config->>'visibility' = 'public')::int AS public_profiles,
      (SELECT COALESCE(sum(view_count),0) FROM profiles)::bigint AS total_views`);
  const moderation = await one(`SELECT (SELECT count(*) FROM reports WHERE status = 'pending')::int AS pending_reports,
      (SELECT count(*) FROM reports WHERE status IN ('resolved','rejected'))::int AS resolved_reports,
      (SELECT count(*) FROM account_bans WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now()))::int AS active_bans,
      (SELECT count(*) FROM account_locks WHERE unlocked_at IS NULL)::int AS locked_accounts,
      (SELECT count(*) FROM support_tickets WHERE status IN ('open','awaiting_staff','escalated'))::int AS pending_tickets,
      (SELECT count(*) FROM custom_badges WHERE status = 'pending')::int AS pending_custom_badges`);
  const monetization = c.can("payments.view") ? await one(`SELECT
      (SELECT count(DISTINCT user_id) FROM entitlements WHERE kind = 'premium' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()))::int AS premium_users,
      (SELECT count(*) FROM purchases WHERE status IN ('paid','refunded','partially_refunded') AND created_at BETWEEN $1 AND $2)::int AS purchases,
      (SELECT count(*) FROM purchases WHERE product_key = 'verified' AND status = 'paid')::int AS verified_purchases,
      (SELECT count(*) FROM purchases WHERE product_key = 'badge_pack' AND status = 'paid')::int AS badge_pack_purchases,
      (SELECT COALESCE(sum(amount_cents),0) FROM payments WHERE status = 'succeeded' AND at BETWEEN $1 AND $2)::bigint AS revenue_cents,
      (SELECT count(*) FROM payments WHERE status = 'failed' AND at BETWEEN $1 AND $2)::int AS failed_payments,
      (SELECT COALESCE(sum(amount_cents),0) FROM refunds WHERE at BETWEEN $1 AND $2)::bigint AS refunded_cents`, [from, to]) : null;
  const t0 = Date.now();
  await app.db.query("SELECT 1");
  const infra = {
    dbLatencyMs: Date.now() - t0, pool: app.db.stats, storage: app.storageStatus,
    storageBytes: Number((await one("SELECT COALESCE(sum(size_bytes),0)::bigint AS n FROM assets WHERE status = 'ready'")).n),
    jobs: await all("SELECT status, count(*)::int AS n FROM jobs WHERE created_at > now() - interval '7 days' GROUP BY status"),
    emailOutbox: await all("SELECT status, count(*)::int AS n FROM email_outbox GROUP BY status"),
    uptimeSec: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576),
  };
  const charts = {
    registrations: await all(`SELECT d::date AS day, (SELECT count(*) FROM users u WHERE u.created_at >= d AND u.created_at < d + interval '1 day')::int AS n
      FROM generate_series(date_trunc('day', $1::timestamptz), $2::timestamptz, interval '1 day') d ORDER BY d`, [from, to]),
    views: await all(`SELECT d::date AS day, (SELECT count(*) FROM analytics_events e WHERE e.kind = 'view' AND e.at >= d AND e.at < d + interval '1 day')::int AS n
      FROM generate_series(date_trunc('day', $1::timestamptz), $2::timestamptz, interval '1 day') d ORDER BY d`, [from, to]),
    revenue: c.can("payments.view") ? await all(`SELECT d::date AS day, (SELECT COALESCE(sum(amount_cents),0) FROM payments p WHERE p.status = 'succeeded' AND p.at >= d AND p.at < d + interval '1 day')::bigint AS cents
      FROM generate_series(date_trunc('day', $1::timestamptz), $2::timestamptz, interval '1 day') d ORDER BY d`, [from, to]) : null,
    subscriptions: c.can("payments.view") ? await all("SELECT status, count(*)::int AS n FROM subscriptions GROUP BY status") : null,
  };
  const recent = {
    registrations: await all("SELECT id, uid, username, created_at FROM users ORDER BY uid DESC LIMIT 8"),
    purchases: c.can("payments.view") ? await all("SELECT p.id, p.product_key, p.amount_cents, p.status, p.created_at, u.username FROM purchases p JOIN users u ON u.id = p.user_id WHERE p.status <> 'pending' ORDER BY p.created_at DESC LIMIT 8") : null,
    adminActions: c.can("audit.view") ? await all("SELECT a.action, a.at, a.target_username, u.username AS actor FROM admin_audit_log a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.id DESC LIMIT 10") : null,
  };
  const alerts: { level: string; message: string }[] = [];
  const { configStatus } = await import("../../lib/config.ts");
  for (const [k, v] of Object.entries(configStatus(app.cfg))) if (String(v).startsWith("not_configured")) alerts.push({ level: "warning", message: `${k}: ${v}` });
  const { paymentStatus } = await import("../monetization/service.ts");
  if (paymentStatus().startsWith("not_configured")) alerts.push({ level: "warning", message: `payments: ${paymentStatus()}` });
  if (infra.jobs.some((j: any) => j.status === "dead")) alerts.push({ level: "critical", message: "Some background jobs failed permanently — see System Health" });
  return { platform, moderation, monetization, infra, charts, recent, alerts };
}

// ------------------------------------------------------------------ announcements

export async function activeAnnouncements(app: App) {
  return (await app.db.query("SELECT id, title, body, level, starts_at, created_at FROM announcements WHERE published AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()) ORDER BY created_at DESC LIMIT 5")).rows;
}

export { HttpError };
