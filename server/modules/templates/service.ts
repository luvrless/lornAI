/**
 * Template marketplace. A template stores only a validated slice of profile
 * configuration (data, never code). Applying merges that slice into the
 * user's draft and requires explicit confirmation because it overwrites.
 * Asset references are dropped unless the applying user owns the asset
 * (another user's uploads are never borrowed).
 */
import type { App } from "../../app.ts";
import { asJson } from "../../db/pg.ts";
import { HttpError, forbidden, notFound } from "../../lib/errors.ts";
import { profileConfigSchema, ProfileConfig, assetRefs } from "../../../shared/profile-schema.ts";
import { stripRef } from "../media/service.ts";
import { validateConfig } from "../profiles/service.ts";

export type TemplateKind = "full" | "background" | "card" | "typography" | "animation" | "effects";

const SLICES: Record<TemplateKind, (keyof ProfileConfig)[]> = {
  full: ["background", "card", "typography", "cursor", "effects", "animations", "entry", "linksStyle", "badgesStyle", "avatar", "banner"],
  background: ["background"],
  card: ["card"],
  typography: ["typography"],
  animation: ["animations"],
  effects: ["effects", "cursor"],
};

export function sliceConfig(cfg: ProfileConfig, kind: TemplateKind) {
  const out: Record<string, unknown> = {};
  for (const k of SLICES[kind]) out[k] = cfg[k];
  return out;
}

/** Validate a slice by merging it into defaults and re-parsing. */
function validSlice(kind: TemplateKind, slice: unknown) {
  if (!slice || typeof slice !== "object") throw new HttpError(422, "validation_failed", "Template configuration is invalid");
  const allowed = SLICES[kind];
  for (const k of Object.keys(slice)) if (!allowed.includes(k as keyof ProfileConfig)) throw new HttpError(422, "validation_failed", `"${k}" isn't part of a ${kind} template`);
  const r = profileConfigSchema.safeParse(slice);
  if (!r.success) throw new HttpError(422, "validation_failed", "Template configuration is invalid", r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  return sliceConfig(r.data, kind);
}

export async function createTemplate(app: App, userId: string, t: { name: string; description: string; kind: TemplateKind; visibility: string; tags: string[]; fromDraft: boolean; config?: unknown; previewAssetId?: string | null }) {
  let slice: Record<string, unknown>;
  if (t.fromDraft) {
    const draft = profileConfigSchema.parse((await app.db.query("SELECT draft FROM profiles WHERE user_id = $1", [userId])).rows[0].draft);
    slice = sliceConfig(draft, t.kind);
  } else slice = validSlice(t.kind, t.config);
  if (t.previewAssetId) {
    const a = await app.db.query("SELECT 1 FROM assets WHERE id = $1 AND user_id = $2 AND status = 'ready' AND kind = 'image'", [t.previewAssetId, userId]);
    if (!a.rowCount) throw notFound("Preview image not found");
  }
  if (t.visibility === "public") {
    const { isFlagEnabled } = await import("../platform/service.ts");
    if (!(await isFlagEnabled(app, "templates.publish"))) throw forbidden("Publishing templates is currently disabled");
  }
  return (await app.db.query(
    "INSERT INTO templates (owner_id, name, description, kind, config, visibility, tags, preview_asset_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    [userId, t.name, t.description, t.kind, asJson(slice), t.visibility, t.tags, t.previewAssetId ?? null])).rows[0];
}

export async function updateTemplate(app: App, userId: string, id: string, p: { name?: string; description?: string; visibility?: string; tags?: string[]; config?: unknown }) {
  const cur = (await app.db.query("SELECT * FROM templates WHERE id = $1", [id])).rows[0];
  if (!cur || cur.owner_id !== userId) throw notFound("Template not found");
  const cfg = p.config !== undefined ? validSlice(cur.kind, p.config) : cur.config;
  return (await app.db.query(
    `UPDATE templates SET name = COALESCE($2,name), description = COALESCE($3,description), visibility = COALESCE($4,visibility),
       tags = COALESCE($5,tags), config = $6, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, p.name ?? null, p.description ?? null, p.visibility ?? null, p.tags ?? null, asJson(cfg)])).rows[0];
}

export async function deleteTemplate(app: App, userId: string, id: string) {
  const r = await app.db.query("DELETE FROM templates WHERE id = $1 AND owner_id = $2", [id, userId]);
  if (!r.rowCount) throw notFound("Template not found");
}

function present(app: App, t: any, viewer?: string) {
  return {
    id: t.id, name: t.name, description: t.description, kind: t.kind, visibility: t.visibility, tags: t.tags, uses: t.uses, favorites: t.favorites,
    config: t.config, author: t.author, mine: viewer === t.owner_id, favorited: !!t.favorited, createdAt: t.created_at, updatedAt: t.updated_at,
    previewUrl: t.preview_key ? app.storage.publicUrl(t.preview_key) : null,
  };
}

export async function browse(app: App, viewer: string | null, q: { search?: string; kind?: string; sort: "popular" | "new" | "favorites"; mine?: boolean; favorites?: boolean; limit: number; offset: number }) {
  const order = { popular: "t.uses DESC, t.favorites DESC", new: "t.created_at DESC", favorites: "t.favorites DESC" }[q.sort];
  const r = await app.db.query(
    `SELECT t.*, u.username AS author, a.storage_key AS preview_key, (f.user_id IS NOT NULL) AS favorited, count(*) OVER() AS total
     FROM templates t JOIN users u ON u.id = t.owner_id LEFT JOIN assets a ON a.id = t.preview_asset_id AND a.status = 'ready'
     LEFT JOIN template_favorites f ON f.template_id = t.id AND f.user_id = $1
     WHERE (CASE WHEN $2 THEN t.owner_id = $1 WHEN $3 THEN f.user_id IS NOT NULL ELSE t.visibility = 'public' AND NOT t.moderation_hidden AND u.deleted_at IS NULL END)
       AND ($4::text IS NULL OR t.kind = $4)
       AND ($5::text IS NULL OR t.name ILIKE '%' || $5 || '%' OR $5 = ANY(t.tags))
     ORDER BY ${order} LIMIT $6 OFFSET $7`,
    [viewer, !!q.mine, !!q.favorites, q.kind ?? null, q.search ?? null, q.limit, q.offset]);
  return { total: Number(r.rows[0]?.total ?? 0), items: r.rows.map((t) => present(app, t, viewer ?? undefined)) };
}

export async function getTemplate(app: App, viewer: string | null, id: string) {
  const t = (await app.db.query(
    `SELECT t.*, u.username AS author, a.storage_key AS preview_key FROM templates t JOIN users u ON u.id = t.owner_id
     LEFT JOIN assets a ON a.id = t.preview_asset_id WHERE t.id = $1`, [id])).rows[0];
  // Unlisted = reachable by direct link; private = owner only.
  if (!t || (t.visibility === "private" && t.owner_id !== viewer) || (t.moderation_hidden && t.owner_id !== viewer)) throw notFound("Template not found");
  return present(app, t, viewer ?? undefined);
}

export async function favorite(app: App, userId: string, id: string, on: boolean) {
  await getTemplate(app, userId, id);
  await app.db.tx(async (tx) => {
    const r = on
      ? await tx.query("INSERT INTO template_favorites (user_id, template_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, id])
      : await tx.query("DELETE FROM template_favorites WHERE user_id = $1 AND template_id = $2", [userId, id]);
    if (r.rowCount) await tx.query("UPDATE templates SET favorites = favorites + $2 WHERE id = $1", [id, on ? 1 : -1]);
  });
}

/** Merge a template into the draft. `confirm` must be true: this overwrites settings. */
export async function applyTemplate(app: App, userId: string, id: string, confirm: boolean, rev: number) {
  if (!confirm) throw new HttpError(428, "confirmation_required", "Applying a template replaces your current settings for these sections. Confirm to continue.");
  const t = await getTemplate(app, userId, id);
  return app.db.tx(async (tx) => {
    const p = (await tx.query("SELECT draft, draft_rev FROM profiles WHERE user_id = $1 FOR UPDATE", [userId])).rows[0];
    if (p.draft_rev !== rev) throw new HttpError(409, "draft_conflict", "Your draft changed. Reload and try again.");
    let slice: any = t.config;
    const owned = new Set((await tx.query("SELECT id FROM assets WHERE id = ANY($1::uuid[]) AND user_id = $2 AND status = 'ready'", [[...assetRefs(slice)], userId])).rows.map((r) => r.id));
    for (const ref of assetRefs(slice)) if (!owned.has(ref)) slice = stripRef(slice, ref);
    const merged = await validateConfig(app, tx, userId, { ...profileConfigSchema.parse(p.draft), ...slice });
    const r = await tx.query<{ draft_rev: number }>("UPDATE profiles SET draft = $2, draft_rev = draft_rev + 1, draft_updated_at = now() WHERE user_id = $1 RETURNING draft_rev", [userId, asJson(merged)]);
    if (t.mine === false) await tx.query("UPDATE templates SET uses = uses + 1 WHERE id = $1", [id]);
    return { rev: r.rows[0].draft_rev, draft: merged, sections: Object.keys(t.config) };
  });
}
