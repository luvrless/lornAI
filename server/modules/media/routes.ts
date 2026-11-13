import type { App } from "../../app.ts";
import { Router, z } from "../../lib/http.ts";
import { HttpError } from "../../lib/errors.ts";
import * as M from "./service.ts";
import { PgError } from "../../db/pg.ts";

const start = z.object({
  filename: z.string().trim().min(1).max(200), mime: z.string().max(100), size: z.number().int().positive(),
  kind: z.enum(["image", "video", "audio", "font", "cursor", "icon"]).optional(),
  folderId: z.string().uuid().nullable().optional(), replaceAssetId: z.string().uuid().nullable().optional(),
});

export function mediaRoutes(app: App, r: Router) {
  r.post("/api/media/uploads", async (c) => M.startUpload(app, c.user!.id, await c.body(start)),
    { auth: "required", rate: { name: "upload", rule: { capacity: 30, refillPerSec: 0.2 }, by: "user" } });

  // Byte upload for the local storage driver; the one-time token is the credential.
  r.put("/api/media/uploads/:id/blob", async (c) => M.receiveBlob(app, z.string().uuid().parse(c.params.id), c.query.token ?? "", c.req), { skipCsrf: true });

  r.post("/api/media/uploads/:id/complete", async (c) => {
    const b = await c.body(z.object({ name: z.string().max(120).optional() }));
    return M.completeUpload(app, c.user!.id, z.string().uuid().parse(c.params.id), b.name);
  }, { auth: "required" });

  r.get("/api/media", async (c) => M.listAssets(app, c.user!.id, z.object({
    kind: z.enum(["image", "video", "audio", "font", "cursor", "icon"]).optional(), folderId: z.string().optional(), search: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(60), offset: z.coerce.number().int().min(0).default(0),
    sort: z.enum(["new", "old", "name", "size"]).default("new"),
  }).parse(c.query)), { auth: "required" });

  r.get("/api/media/usage", async (c) => ({ ...(await M.quotaFor(app, c.user!.id)), byKind: await M.usageByKind(app, c.user!.id) }), { auth: "required" });

  r.get("/api/media/history", async (c) => (await app.db.query(
    `SELECT s.id, s.filename, s.kind, s.declared_size, s.created_at, s.completed_at, s.asset_id, (s.completed_at IS NULL AND s.expires_at < now()) AS failed
     FROM upload_sessions s WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 100`, [c.user!.id])).rows, { auth: "required" });

  r.get("/api/media/:id", async (c) => {
    const a = await M.getAsset(app, c.user!.id, z.string().uuid().parse(c.params.id));
    return { ...a, usages: await M.assetUsages(app, app.db, c.user!.id, a.id) };
  }, { auth: "required" });

  r.patch("/api/media/:id", async (c) => M.updateAsset(app, c.user!.id, z.string().uuid().parse(c.params.id),
    await c.body(z.object({ name: z.string().trim().min(1).max(120).optional(), folderId: z.string().uuid().nullable().optional() }))), { auth: "required" });

  r.delete("/api/media/:id", async (c) => {
    const b = await c.body(z.object({ force: z.boolean().default(false) }));
    return M.deleteAsset(app, c.user!.id, z.string().uuid().parse(c.params.id), b.force);
  }, { auth: "required" });

  r.get("/api/media-folders", async (c) => M.folders(app, c.user!.id), { auth: "required" });
  r.post("/api/media-folders", async (c) => {
    const b = await c.body(z.object({ name: z.string().trim().min(1).max(60) }));
    const n = (await app.db.query("SELECT count(*)::int AS n FROM asset_folders WHERE user_id = $1", [c.user!.id])).rows[0].n;
    if (n >= 50) throw new HttpError(400, "too_many_folders", "You can have up to 50 folders");
    try { return (await app.db.query("INSERT INTO asset_folders (user_id, name) VALUES ($1,$2) RETURNING id, name, created_at", [c.user!.id, b.name])).rows[0]; }
    catch (e) { if (e instanceof PgError && e.code === "23505") throw new HttpError(409, "conflict", "A folder with this name exists"); throw e; }
  }, { auth: "required" });
  r.patch("/api/media-folders/:id", async (c) => {
    const b = await c.body(z.object({ name: z.string().trim().min(1).max(60) }));
    try {
      const x = await app.db.query("UPDATE asset_folders SET name = $3 WHERE id = $1 AND user_id = $2 RETURNING id, name", [c.params.id, c.user!.id, b.name]);
      if (!x.rowCount) throw new HttpError(404, "not_found", "Folder not found");
      return x.rows[0];
    } catch (e) { if (e instanceof PgError && e.code === "23505") throw new HttpError(409, "conflict", "A folder with this name exists"); throw e; }
  }, { auth: "required" });
  r.delete("/api/media-folders/:id", async (c) => {
    // Files move back to "All files"; nothing is deleted.
    const x = await app.db.query("DELETE FROM asset_folders WHERE id = $1 AND user_id = $2", [c.params.id, c.user!.id]);
    if (!x.rowCount) throw new HttpError(404, "not_found", "Folder not found");
  }, { auth: "required" });
}
