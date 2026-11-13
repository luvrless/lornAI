/**
 * Dynamic badge registry. Badges live only in the database; the renderer
 * draws whatever the registry returns, so a badge created in the admin panel
 * appears on profiles with no code change.
 *
 * Availability rules (enforced here, never in the UI):
 *  assignable    → needs badges.assign
 *  restricted    → needs badges.assign_restricted
 *  event_only / purchase_only / automatic → only the system (events,
 *                  payments, milestones), or an actor with assign_restricted
 *  disabled or archived → no new acquisitions; existing ownership untouched
 */
import { z } from "zod";
import type { App, Queryable } from "../../app.ts";
import type { Ctx } from "../../lib/http.ts";
import { HttpError, conflict, forbidden, notFound, badRequest } from "../../lib/errors.ts";
import { audit, AuditActor, notify } from "../platform/service.ts";
import { actorOf } from "../authz/service.ts";
import { hex } from "../../../shared/profile-schema.ts";

export const BADGE_CATEGORIES = ["verified", "premium", "staff", "developer", "founder", "early_supporter", "og", "community", "helper", "event", "milestone", "custom", "special"] as const;
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
export const AVAILABILITY = ["assignable", "restricted", "event_only", "purchase_only", "automatic"] as const;
export const ICON_PRESETS = ["crown", "check", "shield", "code", "star", "flame", "snowflake", "egg", "sun", "gem", "heart", "bolt", "trophy", "globe", "bug", "sparkles", "rocket", "music", "gamepad", "medal", "wrench", "bulb", "coins", "gift", "boost", "award", "image", "party"] as const;
export type Method = "manual" | "automatic" | "event" | "purchase" | "milestone" | "admin_grant" | "custom";

export const badgeInput = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,40}$/, "Lowercase letters, numbers and underscores"),
  name: z.string().trim().min(1).max(40),
  description: z.string().max(300).default(""),
  tooltip: z.string().max(80).default(""),
  category: z.enum(BADGE_CATEGORIES),
  rarity: z.enum(RARITIES).default("common"),
  iconAssetId: z.string().uuid().nullable().default(null),
  iconPreset: z.enum(ICON_PRESETS).nullable().default("star"),
  color: hex.default("#60a5fa"),
  gradientFrom: hex.nullable().default(null),
  gradientTo: hex.nullable().default(null),
  borderColor: hex.nullable().default(null),
  glow: z.number().int().min(0).max(100).default(0),
  hover: z.enum(["none", "lift", "glow", "scale", "spin", "shine"]).default("lift"),
  displaySize: z.number().int().min(12).max(64).default(22),
  sortOrder: z.number().int().min(0).max(10000).default(100),
  enabled: z.boolean().default(true),
  visibility: z.enum(["public", "hidden"]).default("public"),
  availability: z.enum(AVAILABILITY).default("assignable"),
  eligibility: z.object({
    method: z.enum(["manual", "automatic"]).default("manual"),
    minAccountAgeDays: z.number().int().min(0).max(36500).nullable().default(null),
    registeredBefore: z.string().datetime().nullable().default(null),
    maxUid: z.number().int().positive().nullable().default(null),
    note: z.string().max(200).default(""),
  }).default({}),
});
export type BadgeInput = z.infer<typeof badgeInput>;

/** Initial registry rows (editable afterwards like any other badge). */
const SEED: Partial<BadgeInput>[] = [
  { key: "owner", name: "Founder", description: "The founder of LORN.LOL.", category: "founder", rarity: "mythic", iconPreset: "crown", color: "#facc15", gradientFrom: "#fde68a", gradientTo: "#f59e0b", availability: "restricted", tooltip: "Founder", sortOrder: 1 },
  { key: "staff", name: "Staff", description: "Be a part of the LORN.LOL staff team.", category: "staff", rarity: "legendary", iconPreset: "wrench", color: "#60a5fa", availability: "restricted", tooltip: "Staff", sortOrder: 2 },
  { key: "helper", name: "Helper", description: "Be active and help users in the community.", category: "helper", rarity: "uncommon", iconPreset: "bulb", color: "#fbbf24", availability: "assignable", tooltip: "Helper", sortOrder: 3 },
  { key: "premium", name: "Premium", description: "Purchase the Premium package.", category: "premium", rarity: "rare", iconPreset: "gem", color: "#c084fc", availability: "purchase_only", tooltip: "Premium", sortOrder: 4 },
  { key: "verified", name: "Verified", description: "Purchase or be a known content creator.", category: "verified", rarity: "epic", iconPreset: "check", color: "#3b82f6", availability: "restricted", tooltip: "Verified", sortOrder: 5 },
  { key: "donor", name: "Donor", description: "Donate at least $10 to LORN.LOL.", category: "special", rarity: "rare", iconPreset: "coins", color: "#22c55e", availability: "purchase_only", tooltip: "Donor", sortOrder: 6 },
  { key: "og", name: "OG", description: "Be one of the first 150 people on LORN.LOL.", category: "og", rarity: "legendary", iconPreset: "flame", color: "#fb923c", availability: "automatic", tooltip: "OG — one of the first 150", sortOrder: 7 },
  { key: "gifter", name: "Gifter", description: "Gift a LORN.LOL product to another user.", category: "special", rarity: "rare", iconPreset: "gift", color: "#f59e0b", availability: "automatic", tooltip: "Gifter", sortOrder: 8 },
  { key: "server_booster", name: "Server Booster", description: "Boost the LORN.LOL Discord server.", category: "community", rarity: "rare", iconPreset: "boost", color: "#f472b6", availability: "automatic", tooltip: "Server Booster", sortOrder: 9 },
  { key: "winner", name: "Winner", description: "Win a LORN.LOL event.", category: "event", rarity: "legendary", iconPreset: "trophy", color: "#facc15", availability: "assignable", tooltip: "Winner", sortOrder: 10 },
  { key: "second_place", name: "Second Place", description: "Get second place in a LORN.LOL event.", category: "event", rarity: "epic", iconPreset: "award", color: "#cbd5e1", availability: "assignable", tooltip: "Second Place", sortOrder: 11 },
  { key: "third_place", name: "Third Place", description: "Get third place in a LORN.LOL event.", category: "event", rarity: "rare", iconPreset: "award", color: "#d97706", availability: "assignable", tooltip: "Third Place", sortOrder: 12 },
  { key: "image_host", name: "Image Host", description: "Purchase the Image Host.", category: "special", rarity: "rare", iconPreset: "image", color: "#34d399", availability: "purchase_only", tooltip: "Image Host", sortOrder: 13 },
  { key: "bug_hunter", name: "Bug Hunter", description: "Report a bug to the LORN.LOL team.", category: "helper", rarity: "uncommon", iconPreset: "bug", color: "#4ade80", availability: "assignable", tooltip: "Bug Hunter", sortOrder: 14 },
  { key: "easter_2027", name: "Easter 2027", description: "Exclusive badge from the Easter 2027 sale.", category: "event", rarity: "rare", iconPreset: "egg", color: "#fda4af", availability: "event_only", tooltip: "Easter 2027", sortOrder: 15 },
  { key: "christmas_2026", name: "Christmas 2026", description: "Exclusive badge from the Christmas 2026 sale.", category: "event", rarity: "rare", iconPreset: "snowflake", color: "#ef4444", availability: "event_only", tooltip: "Christmas 2026", sortOrder: 16 },
  { key: "the_million", name: "The Million", description: "Celebration badge for 1M users.", category: "milestone", rarity: "mythic", iconPreset: "party", color: "#38bdf8", availability: "automatic", tooltip: "Here for 1,000,000 users", sortOrder: 17 },
  { key: "developer", name: "Developer", description: "Builds LORN.LOL.", category: "developer", rarity: "legendary", iconPreset: "code", color: "#22d3ee", availability: "restricted", tooltip: "Developer", sortOrder: 30 },
  { key: "early_supporter", name: "Early Supporter", description: "Supported LORN.LOL early on.", category: "early_supporter", rarity: "rare", iconPreset: "heart", color: "#f472b6", availability: "assignable", tooltip: "Early Supporter", sortOrder: 31 },
  { key: "milestone_1k", name: "1K", description: "Here when LORN.LOL reached 1,000 users.", category: "milestone", rarity: "rare", iconPreset: "trophy", color: "#34d399", availability: "automatic", tooltip: "Here for 1,000 users", sortOrder: 32 },
  { key: "summer_2027", name: "Summer 2027", description: "Exclusive badge from Summer 2027.", category: "event", rarity: "rare", iconPreset: "sun", color: "#fbbf24", availability: "event_only", tooltip: "Summer 2027", sortOrder: 33 },
];

export async function seedBadges(db: Queryable) {
  for (const s of SEED) {
    const b = badgeInput.parse(s);
    await db.query(
      `INSERT INTO badges (key, name, description, tooltip, category, rarity, icon_preset, color, gradient_from, gradient_to, sort_order, availability)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (key) DO NOTHING`,
      [b.key, b.name, b.description, b.tooltip, b.category, b.rarity, b.iconPreset, b.color, b.gradientFrom, b.gradientTo, b.sortOrder, b.availability]);
  }
}

function present(app: App | null, b: any) {
  return {
    id: b.id, key: b.key, name: b.name, description: b.description, tooltip: b.tooltip || b.name, category: b.category, rarity: b.rarity,
    iconUrl: b.icon_key && app ? app.storage.publicUrl(b.icon_key) : null, iconPreset: b.icon_preset,
    color: b.color, gradientFrom: b.gradient_from, gradientTo: b.gradient_to, borderColor: b.border_color, glow: b.glow,
    hover: b.hover, displaySize: b.display_size,
  };
}
export type PublicBadge = ReturnType<typeof present>;

export async function publicBadges(db: Queryable, userId: string, app: App) {
  const rows = (await db.query(
    `SELECT b.*, a.storage_key AS icon_key FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
     LEFT JOIN assets a ON a.id = b.icon_asset_id AND a.status = 'ready'
     WHERE ub.user_id = $1 AND NOT ub.hidden AND b.visibility = 'public' AND b.archived_at IS NULL
     ORDER BY ub.sort_order, b.sort_order, ub.acquired_at`, [userId])).rows;
  return rows.map((b) => present(app, b));
}

export async function myBadges(app: App, userId: string) {
  const rows = (await app.db.query(
    `SELECT b.*, a.storage_key AS icon_key, ub.hidden, ub.sort_order AS user_order, ub.method, ub.acquired_at FROM user_badges ub
     JOIN badges b ON b.id = ub.badge_id LEFT JOIN assets a ON a.id = b.icon_asset_id AND a.status = 'ready'
     WHERE ub.user_id = $1 AND b.archived_at IS NULL ORDER BY ub.sort_order, b.sort_order`, [userId])).rows;
  return rows.map((b) => ({ ...present(app, b), hidden: b.hidden, method: b.method, acquiredAt: b.acquired_at, hiddenByPlatform: b.visibility === "hidden" }));
}

export async function setUserBadgePrefs(app: App, userId: string, order: string[], hidden: string[]) {
  await app.db.tx(async (tx) => {
    const owned = new Set((await tx.query("SELECT badge_id FROM user_badges WHERE user_id = $1", [userId])).rows.map((r) => r.badge_id));
    for (const id of [...order, ...hidden]) if (!owned.has(id)) throw forbidden("You can only arrange badges you own");
    let i = 0;
    for (const id of order) await tx.query("UPDATE user_badges SET sort_order = $3 WHERE user_id = $1 AND badge_id = $2", [userId, id, i++]);
    await tx.query("UPDATE user_badges SET hidden = (badge_id = ANY($2::uuid[])) WHERE user_id = $1", [userId, hidden]);
  });
  const { invalidateProfileCache } = await import("../profiles/service.ts");
  invalidateProfileCache(app, userId);
}

// ------------------------------------------------------------------ assignment

export interface AssignOpts {
  method: Method;
  reason?: string | null;
  /** null = the system (events, milestones, payments). */
  actor: { ctx?: Ctx; audit?: AuditActor; canAssign: boolean; canRestricted: boolean } | null;
  idempotencyKey?: string;
}

/** Assign a badge. Returns false if the user already owned it. Idempotent per key. */
export async function assignBadge(app: App, db: Queryable, userId: string, badgeRef: string, o: AssignOpts): Promise<boolean> {
  const b = (await db.query(`SELECT * FROM badges WHERE ${/^[0-9a-f-]{36}$/.test(badgeRef) ? "id = $1" : "key = $1"}`, [badgeRef])).rows[0];
  if (!b) throw notFound(`Badge ${badgeRef} not found`);
  if (!b.enabled || b.archived_at) throw new HttpError(409, "badge_disabled", `${b.name} is disabled and can't be newly assigned`);
  if (o.actor) {
    const needRestricted = b.availability !== "assignable";
    if (needRestricted ? !o.actor.canRestricted : !o.actor.canAssign) {
      throw forbidden(needRestricted ? `${b.name} is a restricted badge` : "You can't assign badges");
    }
  } else if (b.availability === "assignable" || b.availability === "restricted") {
    if (!["milestone", "event", "purchase", "automatic", "custom"].includes(o.method)) throw forbidden("System assignment not allowed for this badge");
  }
  const u = (await db.query("SELECT uid, username, deleted_at FROM users WHERE id = $1", [userId])).rows[0];
  if (!u || u.deleted_at) throw notFound("User not found");
  if (o.idempotencyKey) {
    const seen = await db.query("SELECT 1 FROM badge_assignments WHERE idempotency_key = $1", [o.idempotencyKey]);
    if (seen.rowCount) return false;
  }
  const ins = await db.query(
    "INSERT INTO user_badges (user_id, badge_id, method, source_ref, sort_order) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
    [userId, b.id, o.method, o.idempotencyKey ?? null, b.sort_order]);
  if (!ins.rowCount) return false;
  const actorId = o.actor?.ctx?.user?.id ?? o.actor?.audit?.userId ?? null;
  await db.query(
    "INSERT INTO badge_assignments (user_id, recipient_uid, badge_id, action, method, reason, actor_user_id, idempotency_key) VALUES ($1,$2,$3,'assign',$4,$5,$6,$7)",
    [userId, u.uid, b.id, o.method, o.reason ?? null, actorId, o.idempotencyKey ?? null]);
  if (o.actor) {
    await audit(db, o.actor.ctx ? actorOf(o.actor.ctx) : o.actor.audit!, { action: "badge.assigned", targetUserId: userId, targetUid: Number(u.uid), targetUsername: u.username, targetType: "badge", targetId: b.key, next: { badge: b.key, method: o.method }, reason: o.reason });
  }
  await notify(db, userId, "badge", `You received the ${b.name} badge`, b.description || undefined, { badge: b.key });
  const { invalidateProfileCache } = await import("../profiles/service.ts");
  invalidateProfileCache(app, userId);
  return true;
}

export async function revokeBadge(app: App, c: Ctx, userId: string, badgeId: string, reason: string) {
  await app.db.tx(async (tx) => {
    const b = (await tx.query("SELECT * FROM badges WHERE id = $1", [badgeId])).rows[0];
    if (!b) throw notFound("Badge not found");
    if (b.availability !== "assignable" && !c.can("badges.assign_restricted")) throw forbidden(`${b.name} is a restricted badge`);
    const u = (await tx.query("SELECT uid, username FROM users WHERE id = $1", [userId])).rows[0];
    const del = await tx.query("DELETE FROM user_badges WHERE user_id = $1 AND badge_id = $2 RETURNING method", [userId, badgeId]);
    if (!del.rowCount) throw notFound("User doesn't have this badge");
    await tx.query("INSERT INTO badge_assignments (user_id, recipient_uid, badge_id, action, method, reason, actor_user_id) VALUES ($1,$2,$3,'revoke',$4,$5,$6)",
      [userId, u.uid, badgeId, del.rows[0].method, reason, c.user!.id]);
    await audit(tx, actorOf(c), { action: "badge.revoked", targetUserId: userId, targetUid: Number(u.uid), targetUsername: u.username, targetType: "badge", targetId: b.key, previous: { method: del.rows[0].method }, reason });
  });
  const { invalidateProfileCache } = await import("../profiles/service.ts");
  invalidateProfileCache(app, userId);
}

// ------------------------------------------------------------------ admin registry

export async function listBadges(app: App, q: { search?: string; category?: string; includeArchived?: boolean }) {
  return (await app.db.query(
    `SELECT b.*, a.storage_key AS icon_key, (SELECT count(*)::int FROM user_badges ub WHERE ub.badge_id = b.id) AS owners
     FROM badges b LEFT JOIN assets a ON a.id = b.icon_asset_id AND a.status = 'ready'
     WHERE ($1::text IS NULL OR b.name ILIKE '%' || $1 || '%' OR b.key ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR b.category = $2) AND ($3 OR b.archived_at IS NULL)
     ORDER BY b.sort_order, b.created_at`, [q.search ?? null, q.category ?? null, !!q.includeArchived])).rows
    .map((b) => ({ ...present(app, b), enabled: b.enabled, visibility: b.visibility, availability: b.availability, eligibility: b.eligibility, sortOrder: b.sort_order, iconAssetId: b.icon_asset_id, archivedAt: b.archived_at, owners: b.owners, createdAt: b.created_at, updatedAt: b.updated_at }));
}

async function checkArtwork(db: Queryable, assetId: string | null) {
  if (!assetId) return;
  const a = await db.query("SELECT 1 FROM assets WHERE id = $1 AND purpose = 'badge' AND status = 'ready' AND kind IN ('image','icon')", [assetId]);
  if (!a.rowCount) throw badRequest("Badge artwork must be an image uploaded through the badge manager");
}

const COLS = ["key", "name", "description", "tooltip", "category", "rarity", "icon_asset_id", "icon_preset", "color", "gradient_from", "gradient_to", "border_color", "glow", "hover", "display_size", "sort_order", "enabled", "visibility", "availability", "eligibility"];
const vals = (b: BadgeInput) => [b.key, b.name, b.description, b.tooltip, b.category, b.rarity, b.iconAssetId, b.iconPreset, b.color, b.gradientFrom, b.gradientTo, b.borderColor, b.glow, b.hover, b.displaySize, b.sortOrder, b.enabled, b.visibility, b.availability, JSON.stringify(b.eligibility)];

export async function createBadge(app: App, c: Ctx, b: BadgeInput) {
  await checkArtwork(app.db, b.iconAssetId);
  return app.db.tx(async (tx) => {
    const exists = await tx.query("SELECT 1 FROM badges WHERE key = $1", [b.key]);
    if (exists.rowCount) throw conflict("A badge with this internal ID already exists");
    const r = (await tx.query(`INSERT INTO badges (${COLS.join(",")}, created_by) VALUES (${COLS.map((_, i) => `$${i + 1}`).join(",")}, $${COLS.length + 1}) RETURNING *`, [...vals(b), c.user!.id])).rows[0];
    await audit(tx, actorOf(c), { action: "badge.created", targetType: "badge", targetId: r.key, next: b });
    return r;
  });
}

export async function updateBadge(app: App, c: Ctx, id: string, patch: Partial<BadgeInput>, reason?: string) {
  if (patch.iconAssetId) await checkArtwork(app.db, patch.iconAssetId);
  const res = await app.db.tx(async (tx) => {
    const cur = (await tx.query("SELECT * FROM badges WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!cur) throw notFound("Badge not found");
    if (patch.enabled !== undefined && patch.enabled !== cur.enabled) c.require(patch.enabled ? "badges.enable" : "badges.disable");
    const merged = badgeInput.parse({
      name: cur.name, description: cur.description, tooltip: cur.tooltip, category: cur.category, rarity: cur.rarity,
      iconAssetId: cur.icon_asset_id, iconPreset: cur.icon_preset, color: cur.color, gradientFrom: cur.gradient_from, gradientTo: cur.gradient_to,
      borderColor: cur.border_color, glow: cur.glow, hover: cur.hover, displaySize: cur.display_size, sortOrder: cur.sort_order, enabled: cur.enabled,
      visibility: cur.visibility, availability: cur.availability, eligibility: cur.eligibility, ...patch, key: cur.key,
    });
    await tx.query(`UPDATE badges SET ${COLS.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`, [id, ...vals(merged)]);
    const action = patch.enabled === false && cur.enabled ? "badge.disabled" : patch.enabled === true && !cur.enabled ? "badge.enabled" : "badge.edited";
    const changed = Object.fromEntries(Object.entries(patch).filter(([k]) => k !== "key"));
    await audit(tx, actorOf(c), { action, targetType: "badge", targetId: cur.key, previous: { enabled: cur.enabled, name: cur.name, icon: cur.icon_asset_id }, next: changed, reason });
    return merged;
  });
  await invalidateOwners(app, id);
  return res;
}

async function invalidateOwners(app: App, badgeId: string) {
  const { invalidateProfileCache } = await import("../profiles/service.ts");
  for (const r of (await app.db.query("SELECT user_id FROM user_badges WHERE badge_id = $1", [badgeId])).rows) invalidateProfileCache(app, r.user_id);
}

export async function archiveBadge(app: App, c: Ctx, id: string, archived: boolean, reason?: string) {
  const r = await app.db.query("UPDATE badges SET archived_at = CASE WHEN $2 THEN now() ELSE NULL END, updated_at = now() WHERE id = $1 RETURNING key", [id, archived]);
  if (!r.rowCount) throw notFound("Badge not found");
  await audit(app.db, actorOf(c), { action: archived ? "badge.archived" : "badge.unarchived", targetType: "badge", targetId: r.rows[0].key, reason });
  await invalidateOwners(app, id);
}

/** Hard delete only when the badge was never owned; otherwise archive it. */
export async function deleteBadge(app: App, c: Ctx, id: string, confirmKey: string) {
  await app.db.tx(async (tx) => {
    const b = (await tx.query("SELECT key FROM badges WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!b) throw notFound("Badge not found");
    if (confirmKey !== b.key) throw badRequest("Type the badge's internal ID to confirm deletion");
    const hist = (await tx.query("SELECT (SELECT count(*) FROM badge_assignments WHERE badge_id = $1) + (SELECT count(*) FROM user_badges WHERE badge_id = $1) + (SELECT count(*) FROM badge_events WHERE badge_id = $1) AS n", [id])).rows[0];
    if (Number(hist.n) > 0) throw conflict("This badge has ownership history or events. Archive it instead so records are preserved.", "badge_has_history");
    await tx.query("DELETE FROM badges WHERE id = $1", [id]);
    await audit(tx, actorOf(c), { action: "badge.deleted", targetType: "badge", targetId: b.key });
  });
}

export async function badgeRecipients(app: App, id: string, search?: string, limit = 100, offset = 0) {
  return (await app.db.query(
    `SELECT u.id, u.uid, u.username, ub.method, ub.acquired_at, ub.hidden, count(*) OVER() AS total FROM user_badges ub JOIN users u ON u.id = ub.user_id
     WHERE ub.badge_id = $1 AND ($2::text IS NULL OR u.username_lc LIKE lower($2) || '%' OR u.uid::text = $2)
     ORDER BY ub.acquired_at DESC LIMIT $3 OFFSET $4`, [id, search ?? null, limit, offset])).rows;
}

export async function badgeHistory(app: App, badgeId: string | null, userId: string | null, limit = 200) {
  return (await app.db.query(
    `SELECT h.id, h.action, h.method, h.reason, h.at, h.recipient_uid, u.username AS recipient, b.key AS badge, b.name AS badge_name, a.username AS actor
     FROM badge_assignments h JOIN users u ON u.id = h.user_id JOIN badges b ON b.id = h.badge_id LEFT JOIN users a ON a.id = h.actor_user_id
     WHERE ($1::uuid IS NULL OR h.badge_id = $1) AND ($2::uuid IS NULL OR h.user_id = $2) ORDER BY h.id DESC LIMIT $3`, [badgeId, userId, limit])).rows;
}

// ------------------------------------------------------------------ custom badges

export async function creditBalance(db: Queryable, userId: string) {
  return Number((await db.query("SELECT balance FROM badge_credits WHERE user_id = $1", [userId])).rows[0]?.balance ?? 0);
}

export async function addCredits(db: Queryable, userId: string, delta: number, reason: string, ref: string) {
  const l = await db.query("INSERT INTO badge_credit_ledger (user_id, delta, reason, ref) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [userId, delta, reason, ref]);
  if (!l.rowCount) return false; // idempotent
  if (delta >= 0) {
    await db.query("INSERT INTO badge_credits (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = badge_credits.balance + $2", [userId, delta]);
  } else {
    const r = await db.query("UPDATE badge_credits SET balance = balance + $2 WHERE user_id = $1 AND balance + $2 >= 0", [userId, delta]);
    if (!r.rowCount) throw new HttpError(402, "no_credits", "Not enough custom badge credits");
  }
  return true;
}

export async function requestCustomBadge(app: App, userId: string, input: { name: string; iconAssetId: string; color: string }) {
  return app.db.tx(async (tx) => {
    const a = await tx.query("SELECT 1 FROM assets WHERE id = $1 AND user_id = $2 AND status = 'ready' AND kind IN ('image','icon')", [input.iconAssetId, userId]);
    if (!a.rowCount) throw badRequest("Choose an image from your media library");
    const bal = (await tx.query("SELECT balance FROM badge_credits WHERE user_id = $1 FOR UPDATE", [userId])).rows[0]?.balance ?? 0;
    if (bal < 1) throw new HttpError(402, "no_credits", "You need a custom badge credit");
    const r = (await tx.query("INSERT INTO custom_badges (user_id, name, icon_asset_id, color) VALUES ($1,$2,$3,$4) RETURNING *", [userId, input.name, input.iconAssetId, input.color])).rows[0];
    await addCredits(tx, userId, -1, "custom_badge_request", r.id);
    return r;
  });
}

export async function reviewCustomBadge(app: App, c: Ctx, id: string, decision: "approve" | "reject", note: string) {
  const res = await app.db.tx(async (tx) => {
    const cb = (await tx.query("SELECT * FROM custom_badges WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!cb) throw notFound("Request not found");
    if (cb.status !== "pending") throw conflict("This request was already reviewed");
    let badgeId: string | null = null;
    if (decision === "approve") {
      // Copy the user's image into platform-owned badge art so later library edits can't change it.
      const src = (await tx.query("SELECT * FROM assets WHERE id = $1", [cb.icon_asset_id])).rows[0];
      const art = (await tx.query(
        `INSERT INTO assets (user_id, purpose, kind, name, mime, size_bytes, storage_key, thumb_key, width, height, metadata, sha256)
         VALUES (NULL,'badge','icon',$1,$2,$3,'b/' || gen_random_uuid()::text || '.' || $4,NULL,$5,$6,'{}',$7) RETURNING id, storage_key`,
        [`custom-${cb.name}`, src.mime, src.size_bytes, src.storage_key.split(".").pop(), src.width, src.height, src.sha256])).rows[0];
      const bytes = await app.storage.read(src.storage_key);
      if (bytes) await app.storage.put(art.storage_key, bytes, src.mime);
      const key = `custom_${cb.id.replace(/-/g, "").slice(0, 16)}`;
      badgeId = (await tx.query(
        `INSERT INTO badges (key, name, tooltip, category, rarity, icon_asset_id, color, availability, created_by) VALUES ($1,$2,$2,'custom','uncommon',$3,$4,'restricted',$5) RETURNING id`,
        [key, cb.name, art.id, cb.color, c.user!.id])).rows[0].id;
      await assignBadge(app, tx, cb.user_id, badgeId!, { method: "custom", actor: null, reason: "Custom badge approved", idempotencyKey: `custom:${cb.id}` });
    } else {
      await addCredits(tx, cb.user_id, 1, "custom_badge_refund", cb.id);
    }
    await tx.query("UPDATE custom_badges SET status = $2, reviewed_by = $3, review_note = $4, reviewed_at = now(), badge_id = $5 WHERE id = $1",
      [id, decision === "approve" ? "approved" : "rejected", c.user!.id, note, badgeId]);
    await audit(tx, actorOf(c), { action: `custom_badge.${decision === "approve" ? "approved" : "rejected"}`, targetUserId: cb.user_id, targetType: "custom_badge", targetId: id, reason: note });
    await notify(tx, cb.user_id, "badge", decision === "approve" ? `Your custom badge "${cb.name}" was approved` : `Your custom badge "${cb.name}" was not approved`, note || undefined);
    return { status: decision === "approve" ? "approved" : "rejected", badgeId };
  });
  return res;
}

// ------------------------------------------------------------------ catalogue

export type CatalogueAction = "premium" | "verified" | "donate" | "gift" | "claim_boost" | "report_bug";

/**
 * Every public badge with how to get it, for the dashboard's "All badges" list.
 * Status labels and actions are derived from real state (ownership, products,
 * event windows, milestones); nothing here grants anything.
 */
export async function badgeCatalogue(app: App, userId: string) {
  const rows = (await app.db.query(
    `SELECT b.*, a.storage_key AS icon_key, ub.method AS owned_method, ub.acquired_at
     FROM badges b LEFT JOIN assets a ON a.id = b.icon_asset_id AND a.status = 'ready'
     LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = $1
     WHERE b.enabled AND b.visibility = 'public' AND b.archived_at IS NULL
     ORDER BY b.sort_order, b.name`, [userId])).rows;
  const products = new Map((await app.db.query("SELECT key, enabled FROM products")).rows.map((p) => [p.key, p.enabled as boolean]));
  const events = new Map((await app.db.query("SELECT b.key, e.starts_at, e.ends_at FROM badge_events e JOIN badges b ON b.id = e.badge_id WHERE e.enabled")).rows.map((e) => [e.key, e]));
  const milestones = new Map((await app.db.query("SELECT badge_key, kind, threshold, triggered_at FROM platform_milestones")).rows.map((m) => [m.badge_key, m]));
  const registered = Number((await app.db.query("SELECT last FROM uid_counter")).rows[0].last);
  const now = Date.now();

  return rows.map((b) => {
    const owned = !!b.owned_method;
    let status: string | null = null;
    if (owned) status = b.key === "verified" ? "Verified" : b.key === "server_booster" ? "Boosted" : b.key === "donor" ? "Donated"
      : b.owned_method === "purchase" ? "Purchased" : "Unlocked";

    let action: CatalogueAction | null = null;
    if (!owned) {
      if (b.key === "premium" && products.get("premium")) action = "premium";
      else if (b.key === "verified" && products.get("verified")) action = "verified";
      else if (b.key === "donor" && products.get("donation")) action = "donate";
      else if (b.key === "gifter") action = "gift";
      else if (b.key === "server_booster") action = "claim_boost";
      else if (b.key === "bug_hunter") action = "report_bug";
    }

    // When a badge can no longer be earned, say so instead of offering nothing.
    let note: string | null = null;
    const ev = events.get(b.key), ms = milestones.get(b.key);
    if (owned) { /* status says it all */ } else if (ev) {
      if (new Date(ev.ends_at).getTime() < now) note = "No longer obtainable";
      else if (new Date(ev.starts_at).getTime() > now) note = `Available ${new Date(ev.starts_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
      else note = "Available now";
    } else if (ms) {
      if (ms.kind === "first_n" ? registered >= ms.threshold : !!ms.triggered_at) note = "No longer obtainable";
    } else if (b.key === "image_host" && !products.get("image_host")) note = "Not available yet";

    return { ...present(app, b), owned, acquiredAt: b.acquired_at ?? null, status, action, note };
  });
}
