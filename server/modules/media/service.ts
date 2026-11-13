/**
 * Media library: upload sessions, content sniffing (the declared MIME is
 * never trusted), processing (EXIF stripping, thumbnails, ffprobe metadata),
 * quotas, folders, replacement, usage-aware deletion and orphan cleanup.
 */
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fsp from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import type { App, Queryable } from "../../app.ts";
import { HttpError, badRequest, conflict, forbidden, notFound } from "../../lib/errors.ts";
import { randomToken, sha256 } from "../../lib/crypto.ts";
import { getSetting } from "../platform/service.ts";
import { assetRefs } from "../../../shared/profile-schema.ts";
import { hasEntitlement } from "../monetization/entitlements.ts";
import { asJson } from "../../db/pg.ts";

const run = promisify(execFile);

export type Kind = "image" | "video" | "audio" | "font" | "cursor" | "icon";
export const KINDS: Kind[] = ["image", "video", "audio", "font", "cursor", "icon"];

const ALLOWED: Record<Kind, string[]> = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"],
  icon: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  cursor: ["image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/flac", "audio/webm"],
  font: ["font/woff2", "font/woff", "font/ttf", "font/otf"],
};

export const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mp4": "m4a", "audio/flac": "flac", "audio/webm": "weba",
  "font/woff2": "woff2", "font/woff": "woff", "font/ttf": "ttf", "font/otf": "otf",
};
export const MIME_BY_EXT = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));

/** Identify a file by its leading bytes. */
export function sniff(b: Buffer): string | null {
  const at = (o: number, s: string) => b.length >= o + s.length && b.toString("latin1", o, o + s.length) === s;
  if (b.length >= 8 && b.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (at(0, "GIF87a") || at(0, "GIF89a")) return "image/gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (at(0, "RIFF") && at(8, "WAVE")) return "audio/wav";
  if (at(4, "ftyp")) {
    const brand = b.toString("latin1", 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "qt  ") return "video/quicktime";
    if (brand === "M4A " || brand === "M4B ") return "audio/mp4";
    return "video/mp4";
  }
  if (b.length >= 4 && b.readUInt32BE(0) === 0x1a45dfa3) return "video/webm";
  if (at(0, "OggS")) return "audio/ogg";
  if (at(0, "fLaC")) return "audio/flac";
  if (at(0, "ID3") || (b.length > 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (at(0, "wOF2")) return "font/woff2";
  if (at(0, "wOFF")) return "font/woff";
  if (at(0, "OTTO")) return "font/otf";
  if (b.length >= 4 && (b.readUInt32BE(0) === 0x00010000 || at(0, "true"))) return "font/ttf";
  return null;
}

export function kindForMime(mime: string, requested?: Kind): Kind | null {
  if (requested && ALLOWED[requested].includes(mime)) return requested;
  return (KINDS.find((k) => k !== "cursor" && k !== "icon" && ALLOWED[k].includes(mime)) ?? null) as Kind | null;
}

async function limitBytes(app: App, kind: Kind) {
  const mb = kind === "video" ? await getSetting<number>(app, "uploads.max_video_mb", 100)
    : kind === "audio" ? await getSetting<number>(app, "uploads.max_audio_mb", 25)
    : kind === "font" ? 5 : kind === "cursor" || kind === "icon" ? 2
    : await getSetting<number>(app, "uploads.max_image_mb", 10);
  return mb * 1024 * 1024;
}

export async function quotaFor(app: App, userId: string) {
  const premium = await hasEntitlement(app.db, userId, "premium");
  const mb = await getSetting<number>(app, premium ? "uploads.quota_premium_mb" : "uploads.quota_free_mb", 500);
  const used = Number((await app.db.query("SELECT COALESCE(sum(size_bytes),0)::bigint AS n FROM assets WHERE user_id = $1 AND status = 'ready' AND purpose = 'user'", [userId])).rows[0].n);
  return { usedBytes: used, quotaBytes: mb * 1024 * 1024, premium };
}

export async function usageByKind(app: App, userId: string) {
  return (await app.db.query("SELECT kind, count(*)::int AS count, sum(size_bytes)::bigint AS bytes FROM assets WHERE user_id = $1 AND status = 'ready' GROUP BY kind", [userId])).rows;
}

// ------------------------------------------------------------------ sessions

export interface StartUpload { filename: string; mime: string; size: number; kind?: Kind; folderId?: string | null; replaceAssetId?: string | null; purpose?: "user" | "badge" | "evidence" }

export async function startUpload(app: App, userId: string, u: StartUpload) {
  const kind = kindForMime(u.mime, u.kind);
  if (!kind) throw new HttpError(415, "unsupported_type", `Files of type ${u.mime || "unknown"} aren't supported`);
  const max = await limitBytes(app, kind);
  if (u.size <= 0) throw badRequest("Empty file");
  if (u.size > max) throw new HttpError(413, "file_too_large", `This ${kind} is larger than the ${Math.round(max / 1048576)} MB limit`);
  const purpose = u.purpose ?? "user";
  if (purpose === "user") {
    const q = await quotaFor(app, userId);
    if (q.usedBytes + u.size > q.quotaBytes) throw new HttpError(413, "quota_exceeded", "You're out of storage space. Delete some files first.", q);
  }
  if (u.folderId) {
    const f = await app.db.query("SELECT 1 FROM asset_folders WHERE id = $1 AND user_id = $2", [u.folderId, userId]);
    if (!f.rowCount) throw notFound("Folder not found");
  }
  if (u.replaceAssetId) {
    const a = (await app.db.query("SELECT kind FROM assets WHERE id = $1 AND user_id = $2 AND status = 'ready'", [u.replaceAssetId, userId])).rows[0];
    if (!a) throw notFound("Asset to replace not found");
    if (a.kind !== kind) throw badRequest(`Replace a ${a.kind} with another ${a.kind}`);
  }
  const token = randomToken();
  const id = crypto.randomUUID();
  const storageKey = `s/${id}`;
  await app.db.query(
    `INSERT INTO upload_sessions (id, user_id, purpose, token_hash, filename, declared_mime, declared_size, kind, folder_id, replace_asset_id, storage_key, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now() + interval '30 minutes')`,
    [id, userId, purpose, sha256(token), u.filename.slice(0, 200), u.mime, u.size, kind, u.folderId ?? null, u.replaceAssetId ?? null, storageKey]);
  const direct = app.storage.presignPut(storageKey, u.mime, u.size, 1800);
  return {
    uploadId: id, kind, token,
    target: direct ?? { url: `/api/media/uploads/${id}/blob?token=${token}`, method: "PUT" as const, headers: { "Content-Type": u.mime } },
  };
}

/** Local-driver upload body endpoint (S3 deployments upload directly to the bucket). */
export async function receiveBlob(app: App, id: string, token: string, req: import("node:http").IncomingMessage) {
  const s = (await app.db.query("SELECT * FROM upload_sessions WHERE id = $1 AND token_hash = $2 AND completed_at IS NULL AND expires_at > now()", [id, sha256(token)])).rows[0];
  if (!s) throw new HttpError(403, "invalid_upload", "Upload link is invalid or expired");
  const local = app.storage as import("./storage.ts").LocalStorage;
  if (app.storage.name !== "local") throw badRequest("Upload directly to object storage");
  try {
    return { received: await local.putStream(s.storage_key, req, Number(s.declared_size)) };
  } catch (e) {
    if ((e as any).code === "TOO_LARGE") throw new HttpError(413, "file_too_large", "File is larger than declared");
    throw e;
  }
}

interface Processed { mime: string; body: Buffer; width?: number; height?: number; durationMs?: number; thumb?: Buffer; metadata: Record<string, unknown> }

async function probe(buf: Buffer, ext: string) {
  const tmp = path.join(os.tmpdir(), `lorn-${crypto.randomUUID()}.${ext}`);
  await fsp.writeFile(tmp, buf);
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", tmp], { timeout: 20_000, maxBuffer: 4 << 20 });
    const j = JSON.parse(stdout);
    let thumb: Buffer | undefined;
    const video = (j.streams ?? []).find((s: any) => s.codec_type === "video" && !s.disposition?.attached_pic);
    if (video) {
      const out = tmp + ".png";
      try {
        await run("ffmpeg", ["-v", "error", "-ss", "0.5", "-i", tmp, "-frames:v", "1", "-y", out], { timeout: 20_000 });
        thumb = await sharp(await fsp.readFile(out)).resize(480, 480, { fit: "inside" }).webp({ quality: 78 }).toBuffer();
      } catch { /* very short clip: no frame at 0.5s */ }
      await fsp.rm(out, { force: true });
    }
    return { j, video, audio: (j.streams ?? []).find((s: any) => s.codec_type === "audio"), thumb };
  } finally {
    await fsp.rm(tmp, { force: true });
  }
}

export async function processFile(buf: Buffer, kind: Kind): Promise<Processed> {
  const real = sniff(buf);
  if (!real || !ALLOWED[kind].includes(real)) {
    throw new HttpError(415, "invalid_file", `This file's contents are not a supported ${kind} (${real ?? "unrecognised format"})`);
  }
  if (["image", "icon", "cursor"].includes(kind)) {
    let meta;
    try { meta = await sharp(buf, { animated: true, limitInputPixels: 50_000_000 }).metadata(); }
    catch { throw new HttpError(415, "invalid_file", "The image could not be decoded"); }
    const animated = (meta.pages ?? 1) > 1;
    const height = meta.pageHeight ?? meta.height;
    if (kind === "cursor" && ((meta.width ?? 0) > 256 || (height ?? 0) > 256)) throw badRequest("Cursor images must be at most 256×256");
    let body = buf;
    // Re-encode static images: drops EXIF/GPS and applies orientation.
    if (!animated && real !== "image/gif") {
      const img = sharp(buf).rotate();
      body = real === "image/png" ? await img.png().toBuffer() : real === "image/webp" ? await img.webp({ quality: 90 }).toBuffer()
        : real === "image/avif" ? await img.avif().toBuffer() : await img.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    }
    const thumb = await sharp(buf, { animated: false }).rotate().resize(480, 480, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    return { mime: real, body, width: meta.width, height, thumb, metadata: { animated, frames: meta.pages ?? 1 } };
  }
  if (kind === "video" || kind === "audio") {
    const p = await probe(buf, EXT[real]);
    const duration = Number(p.j.format?.duration ?? 0);
    if (kind === "video" && !p.video) throw new HttpError(415, "invalid_file", "No video stream found");
    if (kind === "audio" && !p.audio) throw new HttpError(415, "invalid_file", "No audio stream found");
    const tags = p.j.format?.tags ?? {};
    return {
      mime: kind === "audio" && real === "video/webm" ? "audio/webm" : real, body: buf,
      width: p.video?.width, height: p.video?.height, durationMs: Math.round(duration * 1000), thumb: p.thumb,
      metadata: {
        codec: (p.video ?? p.audio)?.codec_name, hasAudio: !!p.audio, bitrate: Number(p.j.format?.bit_rate ?? 0) || null,
        title: tags.title ?? tags.TITLE ?? null, artist: tags.artist ?? tags.ARTIST ?? null, album: tags.album ?? null,
      },
    };
  }
  return { mime: real, body: buf, metadata: {} }; // font
}

export async function completeUpload(app: App, userId: string, id: string, displayName?: string) {
  const s = (await app.db.query("SELECT * FROM upload_sessions WHERE id = $1 AND user_id = $2", [id, userId])).rows[0];
  if (!s) throw notFound("Upload not found");
  if (s.completed_at) return getAsset(app, userId, s.asset_id);
  if (new Date(s.expires_at) < app.now()) throw new HttpError(410, "upload_expired", "Upload expired, start again");
  const raw = await app.storage.read(s.storage_key);
  if (!raw) throw new HttpError(409, "upload_missing", "No file was received for this upload");
  try {
    if (raw.length > Number(s.declared_size)) throw new HttpError(413, "file_too_large", "File is larger than declared");
    const p = await processFile(raw, s.kind);
    if (s.purpose === "user") {
      const q = await quotaFor(app, userId);
      const replaced = s.replace_asset_id ? Number((await app.db.query("SELECT size_bytes FROM assets WHERE id = $1", [s.replace_asset_id])).rows[0]?.size_bytes ?? 0) : 0;
      if (q.usedBytes - replaced + p.body.length > q.quotaBytes) throw new HttpError(413, "quota_exceeded", "You're out of storage space.");
    }
    const assetId = s.replace_asset_id ?? crypto.randomUUID();
    const version = crypto.randomBytes(4).toString("hex");
    const key = `a/${assetId}-${version}.${EXT[p.mime]}`;
    const thumbKey = p.thumb ? `t/${assetId}-${version}.webp` : null;
    await app.storage.put(key, p.body, p.mime);
    if (p.thumb) await app.storage.put(thumbKey!, p.thumb, "image/webp");
    const hash = crypto.createHash("sha256").update(p.body).digest("hex");
    const name = (displayName ?? s.filename).replace(/[\u0000-\u001f]/g, "").slice(0, 120) || "file";

    const oldKeys = await app.db.tx(async (tx) => {
      let old: string[] = [];
      if (s.replace_asset_id) {
        const prev = (await tx.query("SELECT storage_key, thumb_key FROM assets WHERE id = $1 AND user_id = $2 AND status = 'ready' FOR UPDATE", [assetId, userId])).rows[0];
        if (!prev) throw notFound("Asset to replace no longer exists");
        old = [prev.storage_key, prev.thumb_key].filter(Boolean);
        await tx.query(
          `UPDATE assets SET mime = $2, size_bytes = $3, storage_key = $4, thumb_key = $5, width = $6, height = $7, duration_ms = $8,
             metadata = $9, sha256 = $10, updated_at = now() WHERE id = $1`,
          [assetId, p.mime, p.body.length, key, thumbKey, p.width ?? null, p.height ?? null, p.durationMs ?? null, asJson(p.metadata), hash]);
      } else {
        await tx.query(
          `INSERT INTO assets (id, user_id, folder_id, purpose, kind, name, mime, size_bytes, storage_key, thumb_key, width, height, duration_ms, metadata, sha256)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [assetId, userId, s.folder_id, s.purpose, s.kind, name, p.mime, p.body.length, key, thumbKey, p.width ?? null, p.height ?? null, p.durationMs ?? null, asJson(p.metadata), hash]);
      }
      await tx.query("UPDATE upload_sessions SET completed_at = now(), asset_id = $2 WHERE id = $1", [id, assetId]);
      return old;
    });
    for (const k of [...oldKeys, s.storage_key]) await app.storage.remove(k).catch(() => {});
    if (s.replace_asset_id) await (await import("../profiles/service.ts")).invalidateProfileCache(app, userId);
    return getAsset(app, userId, assetId);
  } catch (e) {
    await app.storage.remove(s.storage_key).catch(() => {});
    await app.db.query("UPDATE upload_sessions SET expires_at = now() WHERE id = $1", [id]);
    throw e;
  }
}

// ------------------------------------------------------------------ library

export function presentAsset(app: App, a: any) {
  return {
    id: a.id, kind: a.kind, name: a.name, mime: a.mime, size: Number(a.size_bytes), width: a.width, height: a.height,
    durationMs: a.duration_ms, folderId: a.folder_id, metadata: a.metadata, createdAt: a.created_at, updatedAt: a.updated_at,
    url: app.storage.publicUrl(a.storage_key), thumbUrl: a.thumb_key ? app.storage.publicUrl(a.thumb_key) : null,
  };
}

export async function getAsset(app: App, userId: string, id: string) {
  const a = (await app.db.query("SELECT * FROM assets WHERE id = $1 AND user_id = $2 AND status = 'ready'", [id, userId])).rows[0];
  if (!a) throw notFound("File not found");
  return presentAsset(app, a);
}

export async function listAssets(app: App, userId: string, q: { kind?: string; folderId?: string | null; search?: string; limit: number; offset: number; sort: "new" | "old" | "name" | "size" }) {
  const order = { new: "created_at DESC", old: "created_at ASC", name: "lower(name) ASC", size: "size_bytes DESC" }[q.sort];
  const r = await app.db.query(
    `SELECT *, count(*) OVER() AS total FROM assets WHERE user_id = $1 AND status = 'ready' AND purpose = 'user'
       AND ($2::text IS NULL OR kind = $2) AND ($3::text IS NULL OR ($3 = 'none' AND folder_id IS NULL) OR folder_id::text = $3)
       AND ($4::text IS NULL OR name ILIKE '%' || $4 || '%')
     ORDER BY ${order} LIMIT $5 OFFSET $6`,
    [userId, q.kind ?? null, q.folderId ?? null, q.search?.replace(/[%_\\]/g, "\\$&") ?? null, q.limit, q.offset]);
  return { total: Number(r.rows[0]?.total ?? 0), items: r.rows.map((a) => presentAsset(app, a)) };
}

export async function updateAsset(app: App, userId: string, id: string, patch: { name?: string; folderId?: string | null }) {
  if (patch.folderId) {
    const f = await app.db.query("SELECT 1 FROM asset_folders WHERE id = $1 AND user_id = $2", [patch.folderId, userId]);
    if (!f.rowCount) throw notFound("Folder not found");
  }
  const r = await app.db.query(
    `UPDATE assets SET name = COALESCE($3, name), folder_id = CASE WHEN $4 THEN $5::uuid ELSE folder_id END, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'ready' RETURNING *`,
    [id, userId, patch.name ?? null, patch.folderId !== undefined, patch.folderId ?? null]);
  if (!r.rowCount) throw notFound("File not found");
  return presentAsset(app, r.rows[0]);
}

/** Where an asset is referenced (draft, published profile, templates, badges). */
export async function assetUsages(app: App, db: Queryable, userId: string, id: string) {
  const out: string[] = [];
  const p = (await db.query(
    `SELECT p.draft, v.config AS published FROM profiles p LEFT JOIN profile_versions v ON v.id = p.published_version_id WHERE p.user_id = $1`, [userId])).rows[0];
  if (p && assetRefs(p.draft).has(id)) out.push("draft profile");
  if (p?.published && assetRefs(p.published).has(id)) out.push("published profile");
  for (const t of (await db.query("SELECT name, config FROM templates WHERE owner_id = $1", [userId])).rows) {
    if (assetRefs(t.config).has(id)) out.push(`template "${t.name}"`);
  }
  const cb = await db.query("SELECT 1 FROM custom_badges WHERE icon_asset_id = $1 AND status IN ('pending','approved')", [id]);
  if (cb.rowCount) out.push("custom badge");
  return out;
}

export async function deleteAsset(app: App, userId: string, id: string, force: boolean) {
  const a = (await app.db.query("SELECT * FROM assets WHERE id = $1 AND user_id = $2 AND status = 'ready'", [id, userId])).rows[0];
  if (!a) throw notFound("File not found");
  const uses = await assetUsages(app, app.db, userId, id);
  if (uses.includes("custom badge")) throw conflict("This file is used by a custom badge and can't be deleted", "asset_in_use");
  if (uses.length && !force) throw new HttpError(409, "asset_in_use", `This file is used in: ${uses.join(", ")}`, { usages: uses });
  await app.db.tx(async (tx) => {
    await tx.query("UPDATE assets SET status = 'deleted', deleted_at = now() WHERE id = $1", [id]);
    if (uses.includes("draft profile")) {
      const d = (await tx.query("SELECT draft FROM profiles WHERE user_id = $1 FOR UPDATE", [userId])).rows[0].draft;
      await tx.query("UPDATE profiles SET draft = $2, draft_rev = draft_rev + 1, draft_updated_at = now() WHERE user_id = $1", [userId, asJson(stripRef(d, id))]);
    }
  });
  const { invalidateProfileCache } = await import("../profiles/service.ts");
  invalidateProfileCache(app, userId);
  return { deleted: true, removedFrom: uses };
}

/** Remove references to an asset: nulls *AssetId fields, drops list items whose required assetId matches. */
export function stripRef(v: any, id: string): any {
  if (Array.isArray(v)) return v.filter((x) => !(x && typeof x === "object" && x.assetId === id && !("platform" in x))).map((x) => stripRef(x, id));
  if (v && typeof v === "object") {
    const o: any = {};
    for (const [k, x] of Object.entries(v)) o[k] = (k === "assetId" || k.endsWith("AssetId")) && x === id ? null : stripRef(x, id);
    return o;
  }
  return v;
}

/** Background job: purge storage for deleted assets and abandoned uploads. */
export async function cleanupOrphans(app: App, graceHours = 24) {
  let removed = 0;
  const dead = (await app.db.query(
    "SELECT id, storage_key, thumb_key FROM assets WHERE status = 'deleted' AND deleted_at < now() - make_interval(hours => $1) AND storage_key NOT LIKE 'x/%' LIMIT 500", [graceHours])).rows;
  for (const a of dead) {
    await app.storage.remove(a.storage_key).catch(() => {});
    if (a.thumb_key) await app.storage.remove(a.thumb_key).catch(() => {});
    await app.db.query("UPDATE assets SET storage_key = 'x/' || id::text, thumb_key = NULL WHERE id = $1", [a.id]);
    removed++;
  }
  const stale = (await app.db.query("SELECT id, storage_key FROM upload_sessions WHERE completed_at IS NULL AND expires_at < now() - interval '1 hour'")).rows;
  for (const s of stale) {
    await app.storage.remove(s.storage_key).catch(() => {});
    await app.db.query("DELETE FROM upload_sessions WHERE id = $1", [s.id]);
    removed++;
  }
  return { removed };
}

export async function folders(app: App, userId: string) {
  return (await app.db.query(
    `SELECT f.id, f.name, f.created_at, count(a.id)::int AS files FROM asset_folders f
     LEFT JOIN assets a ON a.folder_id = f.id AND a.status = 'ready' WHERE f.user_id = $1 GROUP BY f.id ORDER BY lower(f.name)`, [userId])).rows;
}

export { forbidden };
