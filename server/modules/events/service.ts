/**
 * Seasonal events and permanent registration milestones.
 *
 * Events are fixed, one-time editions. Distribution runs as a durable job
 * (scheduled at starts_at, resumed after downtime by a periodic tick) and is
 * idempotent: every recipient row and every badge assignment is keyed, so
 * re-running never duplicates. Failures are recorded per recipient and can be
 * retried.
 *
 * Milestones use the permanent UID (registration order), not live counts.
 */
import { z } from "zod";
import type { App, Queryable } from "../../app.ts";
import type { Ctx } from "../../lib/http.ts";
import { HttpError, badRequest, conflict, forbidden, notFound } from "../../lib/errors.ts";
import { audit } from "../platform/service.ts";
import { actorOf } from "../authz/service.ts";
import { assignBadge } from "../badges/service.ts";
import { enqueue, registerJob, every } from "../jobs/runner.ts";
import { onRegistered } from "../auth/service.ts";
import { asJson } from "../../db/pg.ts";

export const eligibilitySchema = z.object({
  registeredBefore: z.string().datetime().nullable().default(null),   // overrides registration_cutoff when set
  minAccountAgeDays: z.number().int().min(0).max(3650).default(0),
  requireVerifiedEmail: z.boolean().default(false),
  requireLoginDuringEvent: z.boolean().default(false),
  premiumOnly: z.boolean().default(false),
  /** Sale events: only users who completed a purchase (any product, incl. gifts and donations) during the event. */
  requirePurchaseDuringEvent: z.boolean().default(false),
  maxUid: z.number().int().positive().nullable().default(null),
}).default({});

export const eventInput = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().trim().min(1).max(60),
  description: z.string().max(500).default(""),
  badgeId: z.string().uuid().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  registrationCutoff: z.coerce.date().nullable().default(null),
  eligibility: eligibilitySchema,
  enabled: z.boolean().default(true),
});

const SEED_EVENTS = [
  { key: "christmas_2026", name: "Christmas 2026", badge: "christmas_2026", starts: "2026-12-24T00:00:00Z", ends: "2026-12-27T00:00:00Z", cutoff: "2026-12-26T23:59:59Z", sale: true },
  { key: "easter_2027", name: "Easter 2027", badge: "easter_2027", starts: "2027-03-28T00:00:00Z", ends: "2027-03-30T00:00:00Z", cutoff: "2027-03-29T23:59:59Z", sale: true },
  { key: "summer_2027", name: "Summer 2027", badge: "summer_2027", starts: "2027-06-21T00:00:00Z", ends: "2027-09-22T00:00:00Z", cutoff: "2027-09-21T23:59:59Z", sale: false },
];

export async function seedEventsAndMilestones(db: Queryable) {
  for (const e of SEED_EVENTS) {
    await db.query(
      `INSERT INTO badge_events (key, name, description, badge_id, starts_at, ends_at, registration_cutoff, eligibility)
       SELECT $1, $2, $3, b.id, $4, $5, $6, $8 FROM badges b WHERE b.key = $7 ON CONFLICT (key) DO NOTHING`,
      [e.key, e.name, e.sale ? `Exclusive badge from the ${e.name} sale: buy anything on LORN.LOL while it runs.` : `One-time ${e.name} edition. Not repeated in future years.`,
       e.starts, e.ends, e.cutoff, e.badge, asJson(e.sale ? { requirePurchaseDuringEvent: true } : {})]);
  }
  await db.query(`INSERT INTO platform_milestones (key, name, kind, threshold, badge_key) VALUES
    ('og', 'OG — first 150 registrations', 'first_n', 150, 'og'),
    ('1k', '1,000 registrations', 'total_reached', 1000, 'milestone_1k'),
    ('1m', '1,000,000 registrations', 'total_reached', 1000000, 'the_million') ON CONFLICT DO NOTHING`);
}

// ------------------------------------------------------------------ eligibility

function eligibilitySql(e: any, ev: any) {
  const rules = eligibilitySchema.parse(e.eligibility ?? {});
  const cutoff = rules.registeredBefore ?? ev.registration_cutoff ?? ev.ends_at;
  return {
    sql: `SELECT u.id FROM users u WHERE u.deleted_at IS NULL AND u.created_at <= $1
      AND NOT EXISTS (SELECT 1 FROM account_bans b WHERE b.user_id = u.id AND b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now()))
      AND u.created_at <= $2::timestamptz - make_interval(days => $3)
      AND ($4 = false OR u.email_verified_at IS NOT NULL)
      AND ($5 = false OR EXISTS (SELECT 1 FROM login_history l WHERE l.user_id = u.id AND l.success AND l.at BETWEEN $6 AND $7))
      AND ($8 = false OR EXISTS (SELECT 1 FROM entitlements en WHERE en.user_id = u.id AND en.kind = 'premium' AND en.revoked_at IS NULL AND (en.expires_at IS NULL OR en.expires_at > now())))
      AND ($9::bigint IS NULL OR u.uid <= $9)
      AND ($10 = false OR EXISTS (SELECT 1 FROM purchases p WHERE p.user_id = u.id AND p.status IN ('paid','partially_refunded') AND p.paid_at BETWEEN $6 AND $7))
      ORDER BY u.uid`,
    params: [cutoff, ev.ends_at, rules.minAccountAgeDays, rules.requireVerifiedEmail, rules.requireLoginDuringEvent, ev.starts_at, ev.ends_at, rules.premiumOnly, rules.maxUid, rules.requirePurchaseDuringEvent],
  };
}

export async function previewRecipients(app: App, eventId: string, limit = 50) {
  const ev = (await app.db.query("SELECT * FROM badge_events WHERE id = $1", [eventId])).rows[0];
  if (!ev) throw notFound("Event not found");
  const q = eligibilitySql(ev, ev);
  const all = (await app.db.query(q.sql, q.params)).rows;
  const sample = all.length ? (await app.db.query("SELECT uid, username, created_at FROM users WHERE id = ANY($1::uuid[]) ORDER BY uid LIMIT $2", [all.map((r) => r.id), limit])).rows : [];
  return { eligible: all.length, sample };
}

// ------------------------------------------------------------------ distribution

export async function startDistribution(app: App, eventId: string, trigger: "manual" | "schedule" | "retry", by: string | null) {
  const ev = (await app.db.query("SELECT * FROM badge_events WHERE id = $1", [eventId])).rows[0];
  if (!ev) throw notFound("Event not found");
  if (!ev.enabled) throw conflict("Event is disabled");
  if (!ev.badge_id) throw conflict("Event has no badge");
  const d = (await app.db.query<{ id: number }>("INSERT INTO event_distributions (event_id, started_by, trigger) VALUES ($1,$2,$3) RETURNING id", [eventId, by, trigger])).rows[0];
  await app.db.query("UPDATE badge_events SET status = 'running', updated_at = now() WHERE id = $1", [eventId]);
  await enqueue(app.db, "event.distribute", { eventId, distributionId: d.id, retryOnly: trigger === "retry" }, { idempotencyKey: `event-dist:${d.id}` });
  return { distributionId: d.id };
}

registerJob("event.distribute", async (app, p: { eventId: string; distributionId: number; retryOnly: boolean }) => {
  const ev = (await app.db.query("SELECT * FROM badge_events WHERE id = $1", [p.eventId])).rows[0];
  if (!p.retryOnly) {
    const q = eligibilitySql(ev, ev);
    const ids = (await app.db.query(q.sql, q.params)).rows.map((r) => r.id);
    // Upsert recipient rows; existing rows keep their status (idempotent re-run).
    for (let i = 0; i < ids.length; i += 500) {
      await app.db.query("INSERT INTO event_recipients (event_id, user_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING", [p.eventId, ids.slice(i, i + 500)]);
    }
  }
  const pending = (await app.db.query("SELECT user_id FROM event_recipients WHERE event_id = $1 AND status IN ('pending','failed')", [p.eventId])).rows;
  for (const r of pending) {
    try {
      const assigned = await app.db.tx((tx) => assignBadge(app, tx, r.user_id, ev.badge_id, { method: "event", actor: null, reason: ev.name, idempotencyKey: `event:${ev.id}:${r.user_id}` }));
      await app.db.query("UPDATE event_recipients SET status = $3, attempts = attempts + 1, error = NULL, updated_at = now() WHERE event_id = $1 AND user_id = $2", [p.eventId, r.user_id, assigned ? "assigned" : "already_owned"]);
    } catch (e) {
      await app.db.query("UPDATE event_recipients SET status = 'failed', attempts = attempts + 1, error = $3, updated_at = now() WHERE event_id = $1 AND user_id = $2", [p.eventId, r.user_id, (e as Error).message.slice(0, 500)]);
    }
  }
  const s = (await app.db.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'assigned')::int AS assigned,
            count(*) FILTER (WHERE status = 'already_owned')::int AS skipped, count(*) FILTER (WHERE status = 'failed')::int AS failed
     FROM event_recipients WHERE event_id = $1`, [p.eventId])).rows[0];
  const status = s.failed ? "failed" : "completed";
  await app.db.query("UPDATE event_distributions SET status = $2, total = $3, assigned = $4, skipped = $5, failed = $6, finished_at = now() WHERE id = $1",
    [p.distributionId, status, s.total, s.assigned, s.skipped, s.failed]);
  await app.db.query("UPDATE badge_events SET status = $2, distributed_at = now(), updated_at = now() WHERE id = $1", [p.eventId, status]);
  await audit(app.db, { userId: null, role: "SYSTEM" }, { action: "event.distribution_completed", targetType: "event", targetId: ev.key, next: s });
});

/** Periodic: start any due event that hasn't run (covers downtime at the scheduled moment). */
export async function scheduleDueEvents(app: App) {
  const due = (await app.db.query("SELECT id FROM badge_events WHERE enabled AND status = 'scheduled' AND starts_at <= now()")).rows;
  for (const e of due) {
    const claimed = await app.db.query("UPDATE badge_events SET status = 'running' WHERE id = $1 AND status = 'scheduled'", [e.id]);
    if (claimed.rowCount) {
      const d = (await app.db.query<{ id: number }>("INSERT INTO event_distributions (event_id, trigger) VALUES ($1,'schedule') RETURNING id", [e.id])).rows[0];
      await enqueue(app.db, "event.distribute", { eventId: e.id, distributionId: d.id, retryOnly: false }, { idempotencyKey: `event-auto:${e.id}` });
    }
  }
}
every(60_000, scheduleDueEvents);

// ------------------------------------------------------------------ admin CRUD

export async function listEvents(app: App) {
  return (await app.db.query(
    `SELECT e.*, b.key AS badge_key, b.name AS badge_name,
       (SELECT count(*)::int FROM event_recipients r WHERE r.event_id = e.id AND r.status IN ('assigned','already_owned')) AS recipients,
       (SELECT count(*)::int FROM event_recipients r WHERE r.event_id = e.id AND r.status = 'failed') AS failures
     FROM badge_events e LEFT JOIN badges b ON b.id = e.badge_id ORDER BY e.starts_at`)).rows;
}

export async function createEvent(app: App, c: Ctx, i: z.infer<typeof eventInput>) {
  if (i.endsAt <= i.startsAt) throw badRequest("End must be after start");
  return app.db.tx(async (tx) => {
    const r = (await tx.query(
      `INSERT INTO badge_events (key, name, description, badge_id, starts_at, ends_at, registration_cutoff, eligibility, enabled, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [i.key, i.name, i.description, i.badgeId, i.startsAt, i.endsAt, i.registrationCutoff, asJson(i.eligibility), i.enabled, c.user!.id])).rows[0];
    await audit(tx, actorOf(c), { action: "event.created", targetType: "event", targetId: i.key, next: i });
    return r;
  });
}

export async function updateEvent(app: App, c: Ctx, id: string, patch: Partial<z.infer<typeof eventInput>> & { ownerOverride?: boolean; reason?: string }) {
  return app.db.tx(async (tx) => {
    const cur = (await tx.query("SELECT * FROM badge_events WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!cur) throw notFound("Event not found");
    const started = new Date(cur.starts_at) <= app.now();
    const touchesEligibility = patch.eligibility !== undefined || patch.registrationCutoff !== undefined || patch.startsAt !== undefined || patch.endsAt !== undefined || patch.badgeId !== undefined;
    if (started && touchesEligibility) {
      if (c.admin!.role !== "OWNER" || !patch.ownerOverride) throw new HttpError(403, "owner_override_required", "This event has started. Only the owner can change eligibility, with an explicit override.");
      if (!patch.reason) throw badRequest("Give a reason for the override");
    }
    const next = {
      name: patch.name ?? cur.name, description: patch.description ?? cur.description, badge_id: patch.badgeId === undefined ? cur.badge_id : patch.badgeId,
      starts_at: patch.startsAt ?? cur.starts_at, ends_at: patch.endsAt ?? cur.ends_at,
      registration_cutoff: patch.registrationCutoff === undefined ? cur.registration_cutoff : patch.registrationCutoff,
      eligibility: patch.eligibility ?? cur.eligibility, enabled: patch.enabled ?? cur.enabled,
    };
    if (new Date(next.ends_at) <= new Date(next.starts_at)) throw badRequest("End must be after start");
    await tx.query(
      `UPDATE badge_events SET name=$2, description=$3, badge_id=$4, starts_at=$5, ends_at=$6, registration_cutoff=$7, eligibility=$8, enabled=$9,
         status = CASE WHEN NOT $9 THEN 'disabled' WHEN status = 'disabled' THEN 'scheduled' ELSE status END, updated_at = now() WHERE id = $1`,
      [id, next.name, next.description, next.badge_id, next.starts_at, next.ends_at, next.registration_cutoff, asJson(next.eligibility), next.enabled]);
    await audit(tx, actorOf(c), {
      action: started && touchesEligibility ? "event.eligibility_overridden" : patch.enabled === false ? "event.disabled" : "event.edited",
      targetType: "event", targetId: cur.key,
      previous: { eligibility: cur.eligibility, cutoff: cur.registration_cutoff, enabled: cur.enabled, starts: cur.starts_at, ends: cur.ends_at },
      next, reason: patch.reason,
    });
    return next;
  });
}

export async function eventRecipients(app: App, id: string, status?: string) {
  return (await app.db.query(
    `SELECT u.uid, u.username, r.status, r.attempts, r.error, r.updated_at FROM event_recipients r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1 AND ($2::text IS NULL OR r.status = $2) ORDER BY u.uid`, [id, status ?? null])).rows;
}

export async function eventHistory(app: App, id: string) {
  return (await app.db.query("SELECT d.*, u.username AS started_by_username FROM event_distributions d LEFT JOIN users u ON u.id = d.started_by WHERE d.event_id = $1 ORDER BY d.id DESC", [id])).rows;
}

// ------------------------------------------------------------------ milestones

// OG: assigned inside the registration transaction, so it's atomic with the UID.
onRegistered(async (app, tx, user) => {
  const { createProfile } = await import("../profiles/service.ts");
  await createProfile(tx, user.id);
  const og = (await tx.query("SELECT threshold FROM platform_milestones WHERE key = 'og'")).rows[0];
  if (og && user.uid <= og.threshold) {
    await tx.query("SAVEPOINT og_badge");
    try {
      await assignBadge(app, tx, user.id, "og", { method: "milestone", actor: null, reason: "First 150 registrations", idempotencyKey: `milestone:og:${user.id}` });
      await tx.query("UPDATE platform_milestones SET recipients = recipients + 1, triggered_at = COALESCE(triggered_at, now()) WHERE key = 'og'");
    } catch (e) {
      // Never fail a registration over a badge; the reconcile job retries.
      await tx.query("ROLLBACK TO SAVEPOINT og_badge");
      await tx.query("UPDATE platform_milestones SET failures = failures + 1 WHERE key = 'og'");
    }
  }
  // 1K, 1M, …: exactly-once — only the transaction that flips triggered_at enqueues.
  const due = (await tx.query("SELECT key FROM platform_milestones WHERE kind = 'total_reached' AND triggered_at IS NULL AND threshold <= $1", [user.uid])).rows;
  for (const m of due) {
    const t = await tx.query("UPDATE platform_milestones SET triggered_at = now() WHERE key = $1 AND triggered_at IS NULL", [m.key]);
    if (t.rowCount) await enqueue(tx, "milestone.total", { key: m.key }, { idempotencyKey: `milestone:${m.key}` });
  }
});

async function distributeMilestone(app: App, key: string) {
  const m = (await app.db.query("SELECT name, threshold, badge_key FROM platform_milestones WHERE key = $1", [key])).rows[0];
  if (!m?.badge_key) return;
  const users = (await app.db.query("SELECT id FROM users WHERE deleted_at IS NULL AND uid <= $1 ORDER BY uid", [m.threshold])).rows;
  let ok = 0, fail = 0;
  for (const u of users) {
    try {
      if (await app.db.tx((tx) => assignBadge(app, tx, u.id, m.badge_key, { method: "milestone", actor: null, reason: `Platform reached ${m.name}`, idempotencyKey: `milestone:${key}:${u.id}` }))) ok++;
    } catch { fail++; }
  }
  await app.db.query("UPDATE platform_milestones SET recipients = recipients + $1, failures = $2 WHERE key = $3", [ok, fail, key]);
  if (fail) throw new Error(`${fail} ${key} milestone assignments failed; will retry`);
}
registerJob("milestone.total", async (app, payload: { key: string }) => distributeMilestone(app, payload.key));
/** Jobs queued before milestones were generalised. */
registerJob("milestone.1k", async (app) => distributeMilestone(app, "1k"));

/** Repairs OG assignments that failed during registration (idempotent). */
registerJob("milestone.og_reconcile", async (app) => {
  const users = (await app.db.query(
    `SELECT u.id FROM users u JOIN platform_milestones m ON m.key = 'og'
     WHERE u.deleted_at IS NULL AND u.uid <= m.threshold AND NOT EXISTS (SELECT 1 FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = u.id AND b.key = 'og')`)).rows;
  for (const u of users) {
    if (await app.db.tx((tx) => assignBadge(app, tx, u.id, "og", { method: "milestone", actor: null, reason: "First 150 registrations", idempotencyKey: `milestone:og:${u.id}` }))) {
      await app.db.query("UPDATE platform_milestones SET recipients = recipients + 1 WHERE key = 'og'");
    }
  }
});

export async function milestoneStatus(app: App) {
  const reg = Number((await app.db.query("SELECT last FROM uid_counter")).rows[0].last);
  const live = Number((await app.db.query("SELECT count(*) FROM users WHERE deleted_at IS NULL")).rows[0].count);
  const ms = (await app.db.query("SELECT * FROM platform_milestones ORDER BY threshold")).rows;
  const hist = (await app.db.query(
    `SELECT b.key, count(*)::int AS assignments, max(h.at) AS last_at FROM badge_assignments h JOIN badges b ON b.id = h.badge_id
     WHERE h.method = 'milestone' GROUP BY b.key`)).rows;
  return {
    totalRegistrations: reg, liveAccounts: live,
    milestones: ms.map((m) => ({
      ...m, progress: Math.min(1, reg / m.threshold),
      status: m.kind === "first_n" ? (reg >= m.threshold ? "closed" : "open") : m.triggered_at ? "triggered" : "pending",
      assignments: hist.find((h) => h.key === m.badge_key)?.assignments ?? 0,
    })),
  };
}

export { forbidden };
