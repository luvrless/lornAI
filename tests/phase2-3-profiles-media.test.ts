/** Acceptance 9–35: profiles, draft/publish, links, widgets, media library. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import sharp from "sharp";
import { startHarness, Harness, Client, newUser, upload, ownerClient } from "./helpers.ts";
import { closeHashPool } from "../server/lib/password.ts";
import { defaultConfig } from "../shared/profile-schema.ts";
import { cleanupOrphans } from "../server/modules/media/service.ts";

let h: Harness;
let jay: Awaited<ReturnType<typeof newUser>>;
let eve: Awaited<ReturnType<typeof newUser>>;
before(async () => {
  process.env.STORAGE_DIR = fs.mkdtempSync("/tmp/lorn-media-");
  h = await startHarness();
  jay = await newUser(h, "jay");
  eve = await newUser(h, "eve");
});
after(async () => { await h.close(); await closeHashPool(); });

const local = (u: string) => h.base + new URL(u).pathname;
const png = (w = 64, hgt = 64, color = { r: 30, g: 80, b: 200 }) => sharp({ create: { width: w, height: hgt, channels: 3, background: color } }).png().toBuffer();

async function editor(c: Client) { return (await c.get("/api/profile/editor")).body; }
async function save(c: Client, mutate: (cfg: any) => void) {
  const e = await editor(c);
  mutate(e.draft);
  return c.put("/api/profile/draft", { config: e.draft, rev: e.rev });
}

test("9: registration creates a private, unpublished profile with full defaults", async () => {
  const e = await editor(jay);
  assert.deepEqual(e.draft, defaultConfig());
  assert.equal(e.isPublished, false);
  assert.equal((await new Client(h.base).get("/api/p/jay")).body.error.code, "profile_unpublished");
  assert.equal((await new Client(h.base).get("/api/p/nobody")).status, 404);
});

test("10/15/16/17/21: customization saves, validates, and persists across reloads", async () => {
  const r = await save(jay, (d) => {
    d.identity.displayName = "Jay"; d.identity.bio = "building lorn";
    d.background = { ...d.background, type: "effect", effect: "galaxy", speed: 1.5, density: 80 };
    d.card = { ...d.card, tilt3d: true, glow: 60, radius: 30, borderGradient: true };
    d.typography = { ...d.typography, font: "Space Grotesk", nameEffect: "glitch", bioEffect: "typewriter", nameGradient: true };
    d.animations.profile = { ...d.animations.profile, type: "zoom", durationMs: 900 };
    d.links = [
      { id: "lnkgithub1", platform: "github", url: "https://github.com/luvrless", title: "GitHub" },
      { id: "lnkroblox1", platform: "roblox", url: "https://www.roblox.com/users/21717734/profile", title: "Roblox", featured: true },
      { id: "lnkfuture1", platform: "custom", url: "https://example.com/soon", title: "Soon", startAt: new Date(Date.now() + 86400_000).toISOString() },
      { id: "lnkhidden1", platform: "custom", url: "https://example.com/hidden", title: "Hidden", visible: false },
    ];
    d.widgets = [{ id: "wdgabout01", type: "about", config: { text: "hi" } }, { id: "wdgclock01", type: "clock", config: { timezone: "Europe/Berlin" } }];
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const again = await editor(jay); // "refresh"
  assert.equal(again.draft.typography.nameEffect, "glitch");
  assert.equal(again.draft.links.length, 4);
  assert.equal(again.draft.widgets[1].config.hour12, false); // widget defaults filled in
  assert.equal(again.hasUnpublishedChanges, true);
});

test("validation rejects unsafe or malformed settings", async () => {
  const bad = async (fn: (d: any) => void) => (await save(jay, fn)).body.error;
  assert.equal((await bad((d) => { d.links.push({ id: "lnkevil001", platform: "custom", url: "javascript:alert(1)" }); })).code, "validation_failed");
  assert.match(JSON.stringify(await bad((d) => { d.links.push({ id: "lnkevil002", platform: "github", url: "https://evil.example/luvrless" }); })), /doesn't look like a GitHub link/);
  assert.equal((await bad((d) => { d.card.bgColor = "red; background:url(x)"; })).code, "validation_failed");
  assert.equal((await bad((d) => { d.card.css = "body{}"; })), undefined); // unknown keys are stripped, not stored
  assert.equal((await editor(jay)).draft.card.css, undefined);
  assert.equal((await bad((d) => { d.widgets.push({ id: "wdgbad0001", type: "clock", config: { timezone: 5 } }); })).message, "Some widget settings are invalid");
  assert.equal((await bad((d) => { d.widgets.push({ id: "wdgbad0002", type: "iframe", config: {} }); })).code, "validation_failed");
});

test("autosave conflicts are detected instead of silently overwriting", async () => {
  const e = await editor(jay);
  assert.equal((await jay.put("/api/profile/draft", { config: e.draft, rev: e.rev })).status, 200);
  const stale = await jay.put("/api/profile/draft", { config: e.draft, rev: e.rev });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, "draft_conflict");
});

test("26/27/28: publish snapshots the draft; later draft edits stay private until republished", async () => {
  assert.deepEqual((await jay.post("/api/profile/publish", { note: "first" })).body, { version: 1 });
  const pub = (await new Client(h.base).get("/api/p/JAY")).body;
  assert.equal(pub.config.identity.displayName, "Jay");
  assert.equal(pub.user.uid, jay.uid);
  assert.deepEqual(pub.config.links.map((l: any) => l.id), ["lnkgithub1", "lnkroblox1"]); // scheduled + hidden links filtered
  assert.ok(pub.badges.some((b: any) => b.key === "og"));

  await save(jay, (d) => { d.identity.displayName = "SECRET DRAFT"; });
  assert.equal((await new Client(h.base).get("/api/p/jay")).body.config.identity.displayName, "Jay");
  await jay.post("/api/profile/publish");
  assert.equal((await new Client(h.base).get("/api/p/jay")).body.config.identity.displayName, "SECRET DRAFT"); // cache invalidated on publish
});

test("version history, rollback and revert", async () => {
  const v = (await jay.get("/api/profile/versions")).body;
  assert.deepEqual(v.map((x: any) => x.version), [2, 1]);
  assert.equal((await jay.post("/api/profile/versions/1/restore")).body.version, 3);
  assert.equal((await new Client(h.base).get("/api/p/jay")).body.config.identity.displayName, "Jay");
  assert.equal((await editor(jay)).draft.identity.displayName, "Jay");
  await save(jay, (d) => { d.identity.bio = "temporary"; });
  await jay.post("/api/profile/revert");
  assert.equal((await editor(jay)).draft.identity.bio, "building lorn");
});

test("unpublish, private and unlisted visibility", async () => {
  await jay.post("/api/profile/unpublish");
  assert.equal((await new Client(h.base).get("/api/p/jay")).body.error.code, "profile_unpublished");
  await save(jay, (d) => { d.visibility = "private"; });
  await jay.post("/api/profile/publish");
  assert.equal((await new Client(h.base).get("/api/p/jay")).body.error.code, "profile_private");
  await save(jay, (d) => { d.visibility = "unlisted"; });
  await jay.post("/api/profile/publish");
  const r = (await new Client(h.base).get("/api/p/jay")).body;
  assert.equal(r.indexable, false);
  await save(jay, (d) => { d.visibility = "public"; });
  await jay.post("/api/profile/publish");
  assert.equal((await new Client(h.base).get("/api/p/jay")).body.indexable, true);
});

// ------------------------------------------------------------------ media

let avatarId = "";
test("11/29/32: image upload — streamed with size cap, re-encoded, thumbnailed, persisted", async () => {
  const withExif = await sharp(await png(800, 600)).withMetadata({ exif: { IFD0: { Copyright: "secret-gps" } } }).jpeg().toBuffer();
  assert.ok(withExif.includes(Buffer.from("secret-gps")));
  const r = await upload(jay, withExif, "me.jpg", "image/jpeg");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  avatarId = r.body.id;
  assert.equal(r.body.kind, "image");
  assert.deepEqual([r.body.width, r.body.height], [800, 600]);
  const file = await fetch(local(r.body.url));
  assert.equal(file.headers.get("content-type"), "image/jpeg");
  const bytes = Buffer.from(await file.arrayBuffer());
  assert.ok(!bytes.includes(Buffer.from("secret-gps")), "EXIF must be stripped");
  assert.equal((await fetch(local(r.body.thumbUrl))).headers.get("content-type"), "image/webp");
  const list = await jay.get("/api/media?kind=image");
  assert.equal(list.body.items[0].id, avatarId);
  // Uploading more than declared is refused mid-stream.
  const s = await jay.post("/api/media/uploads", { filename: "x.png", mime: "image/png", size: 10 });
  const put = await fetch(h.base + s.body.target.url, { method: "PUT", body: new Uint8Array(await png()) });
  assert.equal(put.status, 413);
});

test("31: invalid file contents are rejected regardless of declared type", async () => {
  const fake = await upload(jay, Buffer.from("<svg onload=alert(1)>" + "x".repeat(200)), "evil.png", "image/png");
  assert.equal(fake.status, 415);
  assert.equal((await jay.post("/api/media/uploads", { filename: "a.svg", mime: "image/svg+xml", size: 100 })).status, 415);
  const mp3AsImage = await upload(jay, fs.readFileSync("/tmp/t/test.mp3"), "pic.png", "image/png");
  assert.match(mp3AsImage.body.error.message, /not a supported image/);
  assert.equal((await jay.post("/api/media/uploads", { filename: "big.png", mime: "image/png", size: 50 * 1024 * 1024 })).body.error.code, "file_too_large");
});

let videoId = "";
test("12/13/14: video background on the free plan; audio metadata extracted", async () => {
  const v = await upload(jay, fs.readFileSync("/tmp/t/test.mp4"), "bg.mp4", "video/mp4");
  assert.equal(v.status, 200, JSON.stringify(v.body));
  videoId = v.body.id;
  assert.equal(v.body.durationMs, 2000);
  assert.deepEqual([v.body.width, v.body.height], [320, 240]);
  assert.ok(v.body.thumbUrl);
  const a = await upload(jay, fs.readFileSync("/tmp/t/test.mp3"), "song.mp3", "audio/mpeg");
  assert.equal(a.body.kind, "audio");
  assert.ok(Math.abs(a.body.durationMs - 3000) < 100);
  const s = await save(jay, (d) => {
    d.avatar.assetId = avatarId;
    d.background = { ...d.background, type: "video", assetId: videoId };
    d.music = { ...d.music, enabled: true, tracks: [{ id: "trk0000001", assetId: a.body.id, title: "sedated", artist: "q5" }] };
  });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.deepEqual(s.body.premiumBlocked, []); // video backgrounds are free
  assert.equal((await jay.post("/api/profile/publish")).status, 200);
  const pub = (await new Client(h.base).get("/api/p/jay")).body;
  assert.equal(pub.assets[videoId].mime, "video/mp4");
  assert.equal(pub.assets[avatarId].kind, "image");
  // Range requests work for seeking.
  const part = await fetch(local(pub.assets[videoId].url), { headers: { Range: "bytes=0-99" } });
  assert.equal(part.status, 206);
  assert.equal((await part.arrayBuffer()).byteLength, 100);
});

test("30: ownership — another user's files can't be referenced, completed, or read via the API", async () => {
  const e = await editor(eve);
  e.draft.avatar.assetId = avatarId;
  const r = await eve.put("/api/profile/draft", { config: e.draft, rev: e.rev });
  assert.equal(r.body.error.code, "asset_not_owned");
  assert.equal((await eve.get(`/api/media/${avatarId}`)).status, 404);
  assert.equal((await eve.del(`/api/media/${avatarId}`, { force: true })).status, 404);
  const s = await jay.post("/api/media/uploads", { filename: "x.png", mime: "image/png", size: 5000 });
  assert.equal((await eve.post(`/api/media/uploads/${s.body.uploadId}/complete`)).status, 404);
  assert.equal((await fetch(h.base + `/api/media/uploads/${s.body.uploadId}/blob?token=wrong`, { method: "PUT", body: "x" })).status, 403);
});

test("33: replacing an asset keeps its ID so profiles update without re-editing", async () => {
  const before = (await jay.get(`/api/media/${avatarId}`)).body;
  const r = await upload(jay, await png(100, 100, { r: 250, g: 0, b: 0 }), "new.png", "image/png", { replaceAssetId: avatarId });
  assert.equal(r.body.id, avatarId);
  assert.notEqual(r.body.url, before.url);
  assert.equal((await fetch(local(before.url))).status, 404); // old object removed
  assert.equal((await new Client(h.base).get("/api/p/jay")).body.assets[avatarId].url, r.body.url);
  assert.equal((await upload(jay, fs.readFileSync("/tmp/t/test.mp3"), "x.mp3", "audio/mpeg", { replaceAssetId: avatarId })).body.error.message, "Replace a image with another image");
});

test("34/35: deletion is usage-aware; storage usage is exact", async () => {
  const usage0 = (await jay.get("/api/media/usage")).body;
  const sum = Number((await h.app.db.query("SELECT sum(size_bytes)::bigint AS n FROM assets WHERE user_id = $1 AND status = 'ready'", [jay.userId])).rows[0].n);
  assert.equal(usage0.usedBytes, sum);
  const blocked = await jay.del(`/api/media/${videoId}`, {});
  assert.equal(blocked.status, 409);
  assert.deepEqual(blocked.body.error.details.usages, ["draft profile", "published profile"]);
  const forced = await jay.del(`/api/media/${videoId}`, { force: true });
  assert.deepEqual(forced.body.removedFrom, ["draft profile", "published profile"]);
  assert.equal((await editor(jay)).draft.background.assetId, null);
  const pub = (await new Client(h.base).get("/api/p/jay")).body;
  assert.equal(pub.assets[videoId], undefined); // published page simply drops the missing file
  const usage1 = (await jay.get("/api/media/usage")).body;
  assert.ok(usage1.usedBytes < usage0.usedBytes);
  const keys = (await h.app.db.query("SELECT storage_key FROM assets WHERE id = $1", [videoId])).rows[0];
  await h.app.db.query("UPDATE assets SET deleted_at = now() - interval '2 days' WHERE id = $1", [videoId]);
  const res = await cleanupOrphans(h.app);
  assert.ok(res.removed >= 1);
  assert.equal(fs.existsSync(`${process.env.STORAGE_DIR}/${keys.storage_key}`), false);
});

test("storage quota is enforced", async () => {
  await h.app.db.query("UPDATE platform_settings SET value = '0' WHERE key = 'uploads.quota_free_mb'");
  (await import("../server/modules/platform/service.ts")).clearSettingsCache();
  const r = await eve.post("/api/media/uploads", { filename: "x.png", mime: "image/png", size: 1000 });
  assert.equal(r.body.error.code, "quota_exceeded");
  await h.app.db.query("UPDATE platform_settings SET value = '500' WHERE key = 'uploads.quota_free_mb'");
  (await import("../server/modules/platform/service.ts")).clearSettingsCache();
});

test("folders, rename, move, search", async () => {
  const f = await jay.post("/api/media-folders", { name: "Backgrounds" });
  assert.equal((await jay.patch(`/api/media/${avatarId}`, { name: "Avatar", folderId: f.body.id })).body.folderId, f.body.id);
  assert.equal((await jay.get(`/api/media?folderId=${f.body.id}`)).body.total, 1);
  assert.equal((await jay.get("/api/media?search=avat")).body.items[0].id, avatarId);
  await jay.del(`/api/media-folders/${f.body.id}`);
  assert.equal((await jay.get(`/api/media/${avatarId}`)).body.folderId, null);
});

test("premium-only features are blocked at publish without entitlement", async () => {
  const f = await upload(eve, Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(200)]), "f.woff2", "font/woff2");
  assert.equal(f.status, 200, JSON.stringify(f.body));
  const e = await editor(eve);
  e.draft.typography.customFontAssetId = f.body.id;
  const s = await eve.put("/api/profile/draft", { config: e.draft, rev: e.rev });
  assert.deepEqual(s.body.premiumBlocked, ["Custom fonts"]);
  assert.equal((await eve.post("/api/profile/publish")).status, 402);
  const owner = await ownerClient(h);
  await owner.post(`/api/admin/users/${eve.userId}/premium`, { expiresAt: null, reason: "test grant" });
  assert.equal((await eve.post("/api/profile/publish")).status, 200);
});

test("username change keeps history and enforces a cooldown", async () => {
  const c = await newUser(h, "renamer");
  assert.equal((await c.post("/api/account/username", { username: "renamed" })).status, 200);
  assert.equal((await c.post("/api/account/username", { username: "again" })).body.error.code, "username_cooldown");
  assert.equal((await new Client(h.base).get("/api/auth/username/renamer")).body.available, true);
  const hist = (await c.get("/api/account/username-history")).body;
  assert.equal(hist[0].old_username, "renamer");
});

test("share: QR code endpoint returns a scannable SVG for the profile URL", async () => {
  const r = await fetch(h.base + "/api/p/jay/qr.svg?color=%233b82f6");
  assert.equal(r.headers.get("content-type"), "image/svg+xml");
  assert.match(await r.text(), /^<svg[^>]+viewBox/);
});
