import type { App } from "../../app.ts";
import { Router, z } from "../../lib/http.ts";
import { HttpError } from "../../lib/errors.ts";
import { RULES } from "../../lib/ratelimit.ts";
import * as P from "./service.ts";
import * as A from "../analytics/service.ts";
import { resolveWidgetData } from "../integrations/service.ts";
import { checkUsername } from "../auth/service.ts";
import { audit } from "../platform/service.ts";
import { qrSvg } from "../../../shared/qr.ts";
import { PgError } from "../../db/pg.ts";
import { profileConfigSchema } from "../../../shared/profile-schema.ts";

const hitOf = (app: App, c: any, b: { referrer?: string | null; page?: string | null; utm?: any }) => ({
  ip: c.ip, ua: c.ua, referrer: b.referrer ?? null, page: b.page ?? null, utm: b.utm ?? {},
  country: app.cfg.trustProxy ? String(c.req.headers["cf-ipcountry"] ?? c.req.headers["x-vercel-ip-country"] ?? "") || null : null,
});
const beacon = z.object({
  referrer: z.string().max(2048).nullable().optional(), page: z.string().max(40).nullable().optional(),
  utm: z.object({ source: z.string().max(60).optional(), medium: z.string().max(60).optional(), campaign: z.string().max(80).optional() }).optional(),
});

export function profileRoutes(app: App, r: Router) {
  // ------------------------------------------------------------ editor
  r.get("/api/profile/editor", async (c) => ({ ...(await P.getEditorState(app, c.user!.id)), user: c.user }), { auth: "required" });

  // Small status read for the dashboard header.
  r.get("/api/profile/status", async (c) => {
    const e = await P.getEditorState(app, c.user!.id);
    return { isPublished: e.isPublished, hasUnpublishedChanges: e.hasUnpublishedChanges, publishedAt: e.publishedAt, moderationHidden: e.moderationHidden };
  }, { auth: "required" });

  r.put("/api/profile/draft", async (c) => {
    const b = await c.body(z.object({ config: z.unknown(), rev: z.number().int() }));
    return P.saveDraft(app, c.user!.id, b.config, b.rev);
  }, { auth: "required", rate: { name: "draft", rule: { capacity: 60, refillPerSec: 1 }, by: "user" } });

  r.post("/api/profile/preview", async (c) => {
    const b = await c.body(z.object({ config: z.unknown().optional() }));
    return P.getDraftPayload(app, c.user!.id, b.config);
  }, { auth: "required", rate: { name: "preview", rule: { capacity: 60, refillPerSec: 1 }, by: "user" } });

  r.post("/api/profile/publish", async (c) => {
    const b = await c.body(z.object({ note: z.string().max(140).optional() }));
    return P.publish(app, c.user!.id, b.note);
  }, { auth: "required" });
  r.post("/api/profile/unpublish", async (c) => { await P.unpublish(app, c.user!.id); return { ok: true }; }, { auth: "required" });
  r.post("/api/profile/revert", async (c) => P.revertDraft(app, c.user!.id), { auth: "required" });
  r.get("/api/profile/versions", async (c) => P.listVersions(app, c.user!.id), { auth: "required" });
  r.get("/api/profile/versions/:v", async (c) => P.getVersion(app, c.user!.id, z.coerce.number().int().parse(c.params.v)), { auth: "required" });
  r.post("/api/profile/versions/:v/restore", async (c) => P.rollback(app, c.user!.id, z.coerce.number().int().parse(c.params.v)), { auth: "required" });
  r.get("/api/profile/completion", async (c) => P.profileCompletion(app, c.user!.id), { auth: "required" });

  r.post("/api/account/username", async (c) => {
    const b = await c.body(z.object({ username: z.string().trim().min(1).max(12) }));
    const recent = await app.db.query("SELECT 1 FROM username_history WHERE user_id = $1 AND changed_by IS NULL AND reason = 'self' AND changed_at > now() - interval '7 days'", [c.user!.id]);
    if (recent.rowCount) throw new HttpError(429, "username_cooldown", "You can change your username once every 7 days");
    const chk = await checkUsername(app, app.db, b.username, c.user!.id);
    if (!chk.available) throw new HttpError(409, "username_unavailable", chk.reason!);
    try {
      await app.db.tx(async (tx) => {
        await tx.query("UPDATE users SET username = $2 WHERE id = $1", [c.user!.id, b.username]);
        await tx.query("INSERT INTO username_history (user_id, old_username, new_username, reason) VALUES ($1,$2,$3,'self')", [c.user!.id, c.user!.username, b.username]);
      });
    } catch (e) {
      if (e instanceof PgError && e.code === "23505") throw new HttpError(409, "username_unavailable", "This username is taken");
      throw e;
    }
    P.invalidateProfileCache(app, c.user!.id);
    return { username: b.username };
  }, { auth: "required" });

  r.get("/api/account/username-history", async (c) =>
    (await app.db.query("SELECT old_username, new_username, reason, changed_at, changed_by IS NOT NULL AS by_staff FROM username_history WHERE user_id = $1 ORDER BY changed_at DESC", [c.user!.id])).rows,
    { auth: "required" });

  // ------------------------------------------------------------ public
  r.get("/api/p/:username", async (c) => {
    const res = await P.getPublicProfile(app, c.params.username);
    if (res.status !== "ok") throw new HttpError(res.status === "not_found" ? 404 : 403, `profile_${res.status}`, publicMessage(res.status));
    return res.payload;
  }, { rate: { name: "pview", rule: { capacity: 120, refillPerSec: 2 } } });

  r.get("/api/p/:username/integrations", async (c) => {
    const row = (await app.db.query(
      `SELECT u.id, v.config FROM users u JOIN profiles p ON p.user_id = u.id JOIN profile_versions v ON v.id = p.published_version_id
       WHERE u.username_lc = lower($1) AND u.deleted_at IS NULL AND p.is_published AND NOT p.moderation_hidden`, [c.params.username])).rows[0];
    if (!row) throw new HttpError(404, "not_found", "Profile not found");
    return resolveWidgetData(app, row.id, profileConfigSchema.parse(row.config));
  }, { rate: { name: "pint", rule: { capacity: 20, refillPerSec: 0.5 } } });

  r.post("/api/p/:username/view", async (c) => A.recordView(app, c.params.username, c.user?.id ?? null, hitOf(app, c, await c.body(beacon))),
    { skipCsrf: true, rate: { name: "beacon", rule: { capacity: 30, refillPerSec: 0.5 } } });
  r.post("/api/p/:username/click", async (c) => {
    const b = await c.body(beacon.extend({ linkId: z.string().max(24) }));
    return A.recordClick(app, c.params.username, c.user?.id ?? null, b.linkId, hitOf(app, c, b));
  }, { skipCsrf: true, rate: { name: "beacon", rule: { capacity: 30, refillPerSec: 0.5 } } });
  r.post("/api/p/:username/play", async (c) => {
    const b = await c.body(beacon.extend({ trackId: z.string().max(24) }));
    return A.recordPlay(app, c.params.username, c.user?.id ?? null, b.trackId, hitOf(app, c, b));
  }, { skipCsrf: true, rate: { name: "beacon", rule: { capacity: 30, refillPerSec: 0.5 } } });

  r.get("/api/p/:username/qr.svg", async (c) => {
    const u = (await app.db.query("SELECT username FROM users WHERE username_lc = lower($1) AND deleted_at IS NULL", [c.params.username])).rows[0];
    if (!u) throw new HttpError(404, "not_found", "Profile not found");
    const color = /^#[0-9a-f]{6}$/i.test(c.query.color ?? "") ? c.query.color : "#020617";
    const bg = /^#[0-9a-f]{6}$/i.test(c.query.bg ?? "") ? c.query.bg : "#ffffff";
    const utm = c.query.utm === "1" ? "?utm_source=qr&utm_medium=offline" : "";
    c.send(200, qrSvg(`${app.cfg.appUrl}/${u.username}${utm}`, { dark: color, light: bg, size: 512 }), "image/svg+xml", { "Cache-Control": "public, max-age=300" });
  });

  r.post("/api/reports", async (c) => {
    const b = await c.body(z.object({
      targetType: z.enum(["user", "profile", "content", "custom_badge", "template"]), username: z.string().max(12).optional(), targetRef: z.string().max(200).optional(),
      category: z.enum(["impersonation", "harassment", "inappropriate", "malicious_links", "copyright", "spam", "other"]),
      description: z.string().trim().min(10).max(4000), evidenceUrls: z.array(z.string().url().max(2048)).max(5).default([]), evidenceAssetIds: z.array(z.string().uuid()).max(5).default([]),
    }));
    const { createReport } = await import("../admin/service.ts");
    return createReport(app, c.user!.id, b);
  }, { auth: "required", rate: { name: "report", rule: { capacity: 5, refillPerSec: 5 / 3600 }, by: "user" } });

  void audit; void RULES;
}

export function publicMessage(s: string) {
  return ({ not_found: "This profile doesn't exist", private: "This profile is private", hidden: "This profile is unavailable", banned: "This profile is unavailable" } as Record<string, string>)[s] ?? "Unavailable";
}
