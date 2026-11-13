/**
 * Profiles: the draft is private and autosaved; publishing snapshots it into
 * an immutable version that the public renderer serves. Rollback re-publishes
 * an older snapshot as a new version, so history is never rewritten.
 */
import type { App, Queryable } from "../../app.ts";
import { asJson } from "../../db/pg.ts";
import { HttpError, conflict, notFound } from "../../lib/errors.ts";
import { profileConfigSchema, ProfileConfig, defaultConfig, assetRefs, linkIsLive, PREMIUM_FEATURES } from "../../../shared/profile-schema.ts";
import { validateWidgets } from "../../../shared/widgets.ts";
import { hasEntitlement } from "../monetization/entitlements.ts";
import { presentAsset } from "../media/service.ts";
import { publicBadges } from "../badges/service.ts";
import { getSetting } from "../platform/service.ts";

export async function createProfile(db: Queryable, userId: string) {
  await db.query("INSERT INTO profiles (user_id, draft) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, asJson(defaultConfig())]);
}

/** Full validation: schema, per-widget schemas, asset ownership. */
export async function validateConfig(app: App, db: Queryable, userId: string, raw: unknown): Promise<ProfileConfig> {
  const r = profileConfigSchema.safeParse(raw);
  const issues: { path: string; message: string }[] = [];
  if (!r.success) {
    for (const i of r.error.issues) issues.push({ path: i.path.join("."), message: i.message });
    throw new HttpError(422, "validation_failed", "Some settings are invalid", issues);
  }
  const cfg = r.data;
  cfg.widgets = validateWidgets(cfg.widgets, ["widgets"], issues) as any;
  cfg.pages.forEach((p, i) => { p.widgets = validateWidgets(p.widgets, ["pages", i, "widgets"], issues) as any; });
  if (issues.length) throw new HttpError(422, "validation_failed", "Some widget settings are invalid", issues);

  const refs = [...assetRefs(cfg)];
  if (refs.length) {
    const owned = new Set((await db.query<{ id: string }>(
      "SELECT id FROM assets WHERE id = ANY($1::uuid[]) AND user_id = $2 AND status = 'ready'", [refs, userId])).rows.map((x) => x.id));
    const bad = refs.filter((x) => !owned.has(x));
    if (bad.length) throw new HttpError(422, "asset_not_owned", "Some referenced files don't exist or aren't yours", { assets: bad });
  }
  return cfg;
}

export async function premiumViolations(db: Queryable, userId: string, cfg: ProfileConfig) {
  if (await hasEntitlement(db, userId, "premium")) return [];
  return PREMIUM_FEATURES.filter((f) => f.test(cfg)).map((f) => f.label);
}

export async function getEditorState(app: App, userId: string) {
  const p = (await app.db.query(
    `SELECT p.draft, p.draft_rev, p.draft_updated_at, p.is_published, p.published_at, p.moderation_hidden, p.moderation_reason,
            v.version AS published_version, v.config AS published_config
     FROM profiles p LEFT JOIN profile_versions v ON v.id = p.published_version_id WHERE p.user_id = $1`, [userId])).rows[0];
  if (!p) throw notFound("Profile not found");
  // Old drafts gain any newly added settings with their defaults.
  const draft = profileConfigSchema.safeParse(p.draft);
  return {
    draft: draft.success ? draft.data : p.draft,
    rev: p.draft_rev,
    draftUpdatedAt: p.draft_updated_at,
    isPublished: p.is_published,
    publishedAt: p.published_at,
    publishedVersion: p.published_version,
    hasUnpublishedChanges: !p.published_config || JSON.stringify(p.published_config) !== JSON.stringify(draft.success ? draft.data : p.draft),
    moderationHidden: p.moderation_hidden,
    moderationReason: p.moderation_reason,
    premiumBlocked: draft.success ? await premiumViolations(app.db, userId, draft.data) : [],
  };
}

/** Autosave. `rev` must match the stored revision (another tab may have saved). */
export async function saveDraft(app: App, userId: string, raw: unknown, rev: number) {
  const cfg = await validateConfig(app, app.db, userId, raw);
  const r = await app.db.query<{ draft_rev: number; draft_updated_at: Date }>(
    "UPDATE profiles SET draft = $2, draft_rev = draft_rev + 1, draft_updated_at = now() WHERE user_id = $1 AND draft_rev = $3 RETURNING draft_rev, draft_updated_at",
    [userId, asJson(cfg), rev]);
  if (!r.rowCount) {
    const cur = (await app.db.query("SELECT draft_rev FROM profiles WHERE user_id = $1", [userId])).rows[0];
    throw new HttpError(409, "draft_conflict", "Your profile was changed in another tab or device. Reload to get the latest version.", { rev: cur?.draft_rev });
  }
  return { rev: r.rows[0].draft_rev, savedAt: r.rows[0].draft_updated_at, premiumBlocked: await premiumViolations(app.db, userId, cfg) };
}

async function snapshot(db: Queryable, userId: string, cfg: ProfileConfig, source: "publish" | "rollback" | "template", note?: string) {
  const { rows: [v] } = await db.query<{ id: number; version: number }>(
    `INSERT INTO profile_versions (user_id, version, config, source, note)
     VALUES ($1, COALESCE((SELECT max(version) FROM profile_versions WHERE user_id = $1), 0) + 1, $2, $3, $4) RETURNING id, version`,
    [userId, asJson(cfg), source, note ?? null]);
  await db.query("UPDATE profiles SET published_version_id = $2, published_at = now(), is_published = true WHERE user_id = $1", [userId, v.id]);
  return v;
}

export async function publish(app: App, userId: string, note?: string) {
  const v = await app.db.tx(async (tx) => {
    const p = (await tx.query("SELECT draft FROM profiles WHERE user_id = $1 FOR UPDATE", [userId])).rows[0];
    const cfg = await validateConfig(app, tx, userId, p.draft);
    const blocked = await premiumViolations(tx, userId, cfg);
    if (blocked.length) throw new HttpError(402, "premium_required", `These features need Premium: ${blocked.join(", ")}`, { features: blocked });
    return snapshot(tx, userId, cfg, "publish", note);
  });
  invalidateProfileCache(app, userId);
  return { version: v.version };
}

export async function unpublish(app: App, userId: string) {
  await app.db.query("UPDATE profiles SET is_published = false WHERE user_id = $1", [userId]);
  invalidateProfileCache(app, userId);
}

export async function listVersions(app: App, userId: string) {
  return (await app.db.query(
    `SELECT v.id, v.version, v.source, v.note, v.created_at, (v.id = p.published_version_id) AS current
     FROM profile_versions v JOIN profiles p ON p.user_id = v.user_id WHERE v.user_id = $1 ORDER BY v.version DESC LIMIT 100`, [userId])).rows;
}

export async function getVersion(app: App, userId: string, version: number) {
  const v = (await app.db.query("SELECT config FROM profile_versions WHERE user_id = $1 AND version = $2", [userId, version])).rows[0];
  if (!v) throw notFound("Version not found");
  return v.config;
}

/** Restore a previous version: becomes both the draft and a new published version. */
export async function rollback(app: App, userId: string, version: number) {
  const res = await app.db.tx(async (tx) => {
    const old = (await tx.query("SELECT config FROM profile_versions WHERE user_id = $1 AND version = $2", [userId, version])).rows[0];
    if (!old) throw notFound("Version not found");
    // Assets deleted since then are dropped rather than failing the restore.
    const parsed = profileConfigSchema.parse(old.config);
    const refs = [...assetRefs(parsed)];
    const live = new Set((await tx.query("SELECT id FROM assets WHERE id = ANY($1::uuid[]) AND user_id = $2 AND status = 'ready'", [refs, userId])).rows.map((r) => r.id));
    let cfg: any = parsed;
    const { stripRef } = await import("../media/service.ts");
    for (const r of refs) if (!live.has(r)) cfg = stripRef(cfg, r);
    cfg = await validateConfig(app, tx, userId, cfg);
    await tx.query("UPDATE profiles SET draft = $2, draft_rev = draft_rev + 1, draft_updated_at = now() WHERE user_id = $1", [userId, asJson(cfg)]);
    return snapshot(tx, userId, cfg, "rollback", `Restored version ${version}`);
  });
  invalidateProfileCache(app, userId);
  return { version: res.version };
}

/** Discard unpublished changes. */
export async function revertDraft(app: App, userId: string) {
  const r = await app.db.query(
    `UPDATE profiles p SET draft = v.config, draft_rev = p.draft_rev + 1, draft_updated_at = now()
     FROM profile_versions v WHERE p.user_id = $1 AND v.id = p.published_version_id RETURNING p.draft_rev`, [userId]);
  if (!r.rowCount) throw conflict("Nothing has been published yet");
  return { rev: r.rows[0].draft_rev };
}

// ------------------------------------------------------------------ rendering payload

export interface RenderPayload {
  user: { uid: number; username: string; createdAt: string; premium: boolean; verified: boolean };
  config: ProfileConfig;
  assets: Record<string, ReturnType<typeof presentAsset>>;
  badges: Awaited<ReturnType<typeof publicBadges>>;
  views: number;
  integrations: Record<string, unknown>;
  mode: "published" | "draft";
  indexable: boolean;
}

async function buildPayload(app: App, row: any, cfgRaw: unknown, mode: "published" | "draft"): Promise<RenderPayload> {
  const config = profileConfigSchema.parse(cfgRaw);
  const now = new Date();
  if (mode === "published") {
    config.links = config.links.filter((l) => linkIsLive(l, now));
    config.widgets = config.widgets.filter((w) => w.visible);
    config.pages = config.pages.filter((p) => p.visible).map((p) => ({ ...p, widgets: p.widgets.filter((w) => w.visible) }));
  }
  const refs = [...assetRefs(config)];
  const assets: RenderPayload["assets"] = {};
  if (refs.length) {
    for (const a of (await app.db.query("SELECT * FROM assets WHERE id = ANY($1::uuid[]) AND user_id = $2 AND status = 'ready'", [refs, row.user_id])).rows) {
      assets[a.id] = presentAsset(app, a);
    }
  }
  const { resolveWidgetData } = await import("../integrations/service.ts");
  return {
    user: { uid: Number(row.uid), username: row.username, createdAt: row.created_at, premium: await hasEntitlement(app.db, row.user_id, "premium"), verified: await hasEntitlement(app.db, row.user_id, "verified") },
    config, assets,
    badges: await publicBadges(app.db, row.user_id, app),
    views: Number(row.view_count),
    integrations: await resolveWidgetData(app, row.user_id, config, { cacheOnly: true }),
    mode,
    indexable: mode === "published" && config.visibility === "public" && config.seo.indexable,
  };
}

const cache = new Map<string, { at: number; userId: string; payload: RenderPayload }>();
const CACHE_TTL = 60_000;

export function invalidateProfileCache(_app: App, userId: string) {
  for (const [k, v] of cache) if (v.userId === userId) cache.delete(k);
}

export type PublicResult = { status: "ok"; payload: RenderPayload } | { status: "not_found" | "private" | "unpublished" | "hidden" | "banned" };

/** Keep the cached view counter current without dropping the whole cache entry. */
export function bumpCachedViews(userId: string) {
  for (const v of cache.values()) if (v.userId === userId) v.payload.views += 1;
}

/** Resolve a username to its published profile. Never returns draft content. */
export async function getPublicProfile(app: App, username: string): Promise<PublicResult> {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return { status: "ok", payload: hit.payload };
  const row = (await app.db.query(
    `SELECT u.id AS user_id, u.uid, u.username, u.created_at, p.is_published, p.moderation_hidden, p.view_count, v.config,
       EXISTS (SELECT 1 FROM account_bans b WHERE b.user_id = u.id AND b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now())) AS banned
     FROM users u JOIN profiles p ON p.user_id = u.id LEFT JOIN profile_versions v ON v.id = p.published_version_id
     WHERE u.username_lc = $1 AND u.deleted_at IS NULL`, [key])).rows[0];
  if (!row) return { status: "not_found" };
  if (row.banned) return { status: "banned" };
  if (row.moderation_hidden) return { status: "hidden" };
  if (!row.is_published || !row.config) return { status: "unpublished" };
  if (row.config.visibility === "private") return { status: "private" };
  const payload = await buildPayload(app, row, row.config, "published");
  cache.set(key, { at: Date.now(), userId: row.user_id, payload });
  return { status: "ok", payload };
}

/** Owner-only preview of the draft through the exact same payload builder. */
export async function getDraftPayload(app: App, userId: string, override?: unknown) {
  const row = (await app.db.query(
    "SELECT u.id AS user_id, u.uid, u.username, u.created_at, p.view_count, p.draft FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1", [userId])).rows[0];
  const cfg = override !== undefined ? await validateConfig(app, app.db, userId, override) : row.draft;
  return buildPayload(app, row, cfg, "draft");
}

export async function profileCompletion(app: App, userId: string) {
  const d = profileConfigSchema.parse((await app.db.query("SELECT draft FROM profiles WHERE user_id = $1", [userId])).rows[0].draft);
  const p = (await app.db.query("SELECT is_published FROM profiles WHERE user_id = $1", [userId])).rows[0];
  const checks = [
    ["Display name", !!d.identity.displayName], ["Bio", !!d.identity.bio], ["Avatar", !!d.avatar.assetId],
    ["Background", d.background.type !== "effect" || d.background.effect !== "aurora"], ["A social link", d.links.length > 0],
    ["A widget", d.widgets.length > 0 || d.pages.some((x) => x.widgets.length)], ["Published", p.is_published],
  ] as const;
  return { percent: Math.round((checks.filter((c) => c[1]).length / checks.length) * 100), checks: checks.map(([label, done]) => ({ label, done })) };
}

export { getSetting };
