/**
 * Platform settings, feature flags, audit log and email outbox — the shared
 * services every other module writes through.
 */
import type { App, Queryable } from "../../app.ts";
import { asJson } from "../../db/pg.ts";
import { HttpError, forbidden, notFound } from "../../lib/errors.ts";
import crypto from "node:crypto";

// ------------------------------------------------------------------ settings

const cache = new Map<string, { v: unknown; at: number }>();
const TTL = 3_000;

export async function getSetting<T = unknown>(app: App, key: string, fallback?: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v as T;
  const r = await app.db.query<{ value: T }>("SELECT value FROM platform_settings WHERE key = $1", [key]);
  const v = r.rows[0]?.value ?? fallback;
  cache.set(key, { v, at: Date.now() });
  return v as T;
}

export function clearSettingsCache() {
  cache.clear();
}

export async function listSettings(app: App) {
  return (await app.db.query("SELECT key, value, protected, updated_at FROM platform_settings ORDER BY key")).rows;
}

export async function setSetting(app: App, actor: AuditActor, key: string, value: unknown, canProtected: boolean, reason?: string) {
  return app.db.tx(async (tx) => {
    const cur = (await tx.query("SELECT value, protected FROM platform_settings WHERE key = $1 FOR UPDATE", [key])).rows[0];
    if (!cur) throw notFound(`Unknown setting ${key}`);
    if (cur.protected && !canProtected) throw forbidden("This setting is protected and can only be changed by the owner");
    if (typeof value !== typeof cur.value) throw new HttpError(422, "validation_failed", `Setting ${key} expects a ${typeof cur.value}`);
    await tx.query("UPDATE platform_settings SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1", [key, asJson(value), actor.userId]);
    await audit(tx, actor, { action: "setting.changed", targetType: "setting", targetId: key, previous: { value: cur.value }, next: { value }, reason });
    cache.delete(key);
    return { key, value };
  });
}

// ------------------------------------------------------------------ feature flags

export async function isFlagEnabled(app: App, key: string, subject?: string, isStaff = false): Promise<boolean> {
  const f = (await app.db.query("SELECT enabled, rollout_percent, staff_only FROM feature_flags WHERE key = $1", [key])).rows[0];
  if (!f || !f.enabled) return false;
  if (f.staff_only && !isStaff) return false;
  if (f.rollout_percent >= 100) return true;
  if (!subject) return false;
  const bucket = crypto.createHash("sha256").update(`${key}:${subject}`).digest().readUInt16BE(0) % 100;
  return bucket < f.rollout_percent;
}

// ------------------------------------------------------------------ audit

export interface AuditActor {
  userId: string | null;
  uid?: number | null;
  discordId?: string | null;
  role?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditEntry {
  action: string;
  targetUserId?: string | null;
  targetUid?: number | null;
  targetUsername?: string | null;
  targetType?: string;
  targetId?: string;
  previous?: unknown;
  next?: unknown;
  reason?: string | null;
}

export async function audit(db: Queryable, a: AuditActor, e: AuditEntry) {
  await db.query(
    `INSERT INTO admin_audit_log (actor_user_id, actor_uid, actor_discord_id, actor_role, action,
       target_user_id, target_uid, target_username, target_type, target_id, previous_state, new_state,
       reason, ip, user_agent, request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [a.userId, a.uid ?? null, a.discordId ?? null, a.role ?? null, e.action,
     e.targetUserId ?? null, e.targetUid ?? null, e.targetUsername ?? null, e.targetType ?? null, e.targetId ?? null,
     e.previous === undefined ? null : asJson(e.previous), e.next === undefined ? null : asJson(e.next),
     e.reason ?? null, a.ip ?? null, a.userAgent ?? null, a.requestId ?? null],
  );
}

/** Recompute the hash chain; returns the first broken row id, or null. */
export async function verifyAuditChain(db: Queryable): Promise<number | null> {
  const rows = (await db.query(
    `SELECT id, prev_hash, hash,
       sha256(convert_to(coalesce(encode(prev_hash,'hex'),'') || '|' || action || '|' || coalesce(actor_user_id::text,'') || '|' ||
         coalesce(target_type,'') || '|' || coalesce(target_id,'') || '|' || coalesce(target_user_id::text,'') || '|' ||
         coalesce(previous_state::text,'') || '|' || coalesce(new_state::text,'') || '|' ||
         coalesce(reason,'') || '|' || at::text, 'UTF8')) AS expect,
       lag(hash) OVER (ORDER BY id) AS actual_prev
     FROM admin_audit_log ORDER BY id`)).rows;
  for (const r of rows) {
    if (!r.hash.equals(r.expect)) return r.id;
    if ((r.prev_hash?.toString("hex") ?? null) !== (r.actual_prev?.toString("hex") ?? null)) return r.id;
  }
  return null;
}

// ------------------------------------------------------------------ security events & notifications

export async function securityEvent(db: Queryable, userId: string | null, kind: string, severity: "info" | "warning" | "critical", data: object, ip?: string) {
  await db.query("INSERT INTO security_events (user_id, kind, severity, data, ip) VALUES ($1,$2,$3,$4,$5)", [userId, kind, severity, asJson(data), ip ?? null]);
}

export async function notify(db: Queryable, userId: string, kind: string, title: string, body?: string, data: object = {}) {
  await db.query("INSERT INTO notifications (user_id, kind, title, body, data) VALUES ($1,$2,$3,$4,$5)", [userId, kind, title, body ?? null, asJson(data)]);
}

// ------------------------------------------------------------------ email

export async function queueEmail(app: App, db: Queryable, m: { to: string; subject: string; text: string; html?: string; template: string; userId?: string }) {
  // Without a mail provider the message is recorded honestly as not deliverable.
  const status = app.cfg.smtp || app.cfg.resend ? "pending" : "not_configured";
  const r = await db.query<{ id: number }>(
    "INSERT INTO email_outbox (to_address, subject, text_body, html_body, template, user_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [m.to, m.subject, m.text, m.html ?? null, m.template, m.userId ?? null, status],
  );
  // Account emails shouldn't wait for the next delivery tick: send shortly after the surrounding transaction commits.
  if (status === "pending" && app.cfg.env !== "test") {
    const t = setTimeout(() => { import("../jobs/schedules.ts").then((j) => j.deliverEmails(app)).catch(() => {}); }, 400);
    t.unref?.();
  }
  return { id: r.rows[0].id, delivered: false, status };
}
