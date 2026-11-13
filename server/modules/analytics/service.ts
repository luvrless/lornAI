/**
 * Analytics from real events only. Views are recorded by a beacon the page
 * sends after it renders (so non-JS crawlers don't count), bots are filtered
 * by user agent, and visitors are identified by a daily-rotating salted hash
 * — raw IPs are never stored, and hashes can't be linked across days.
 */
import crypto from "node:crypto";
import type { App, Queryable } from "../../app.ts";
import { HttpError, notFound } from "../../lib/errors.ts";
import { profileConfigSchema } from "../../../shared/profile-schema.ts";
import { bumpCachedViews } from "../profiles/service.ts";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|skype|headless|phantom|curl|wget|python|httpclient|axios|node-fetch|go-http|java\/|okhttp|lighthouse|pingdom|uptime|monitor/i;
export const isBot = (ua: string) => !ua || ua.length < 20 || BOT.test(ua);

export function parseUa(ua: string) {
  const device = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|iPhone|Android/i.test(ua) ? "mobile" : "desktop";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "Other";
  return { device, browser, os };
}

async function dailySalt(db: Queryable): Promise<Buffer> {
  const r = await db.query("INSERT INTO analytics_salts (day, salt) VALUES (current_date, $1) ON CONFLICT (day) DO UPDATE SET day = EXCLUDED.day RETURNING salt", [crypto.randomBytes(32)]);
  return r.rows[0].salt;
}

export interface Hit { ip: string; ua: string; referrer?: string | null; page?: string | null; utm?: { source?: string; medium?: string; campaign?: string }; country?: string | null }

function refHost(ref: string | null | undefined, appOrigin: string) {
  if (!ref) return null;
  try {
    const u = new URL(ref);
    if (u.origin === appOrigin) return null;
    return u.hostname.replace(/^www\./, "").slice(0, 100);
  } catch { return null; }
}

async function owner(app: App, username: string) {
  const r = (await app.db.query(
    `SELECT u.id, v.config FROM users u JOIN profiles p ON p.user_id = u.id LEFT JOIN profile_versions v ON v.id = p.published_version_id
     WHERE u.username_lc = lower($1) AND u.deleted_at IS NULL AND p.is_published`, [username])).rows[0];
  if (!r) throw notFound("Profile not found");
  return r;
}

async function record(app: App, ownerId: string, kind: "view" | "click" | "play", h: Hit, extra: { linkId?: string; dedupeSec: number }) {
  if (isBot(h.ua)) return { recorded: false, reason: "bot" };
  const salt = await dailySalt(app.db);
  const visitor = crypto.createHash("sha256").update(salt).update(ownerId).update(h.ip).update(h.ua).digest().subarray(0, 16);
  const dup = await app.db.query(
    "SELECT 1 FROM analytics_events WHERE user_id = $1 AND kind = $2 AND visitor_hash = $3 AND link_id IS NOT DISTINCT FROM $4 AND at > now() - make_interval(secs => $5) LIMIT 1",
    [ownerId, kind, visitor, extra.linkId ?? null, extra.dedupeSec]);
  if (dup.rowCount) return { recorded: false, reason: "duplicate" };
  const ua = parseUa(h.ua);
  await app.db.query(
    `INSERT INTO analytics_events (user_id, kind, visitor_hash, link_id, page, referrer_host, utm_source, utm_medium, utm_campaign, country, device, browser, os)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [ownerId, kind, visitor, extra.linkId ?? null, h.page?.slice(0, 40) ?? null, refHost(h.referrer, app.cfg.appOrigin),
     h.utm?.source?.slice(0, 60) ?? null, h.utm?.medium?.slice(0, 60) ?? null, h.utm?.campaign?.slice(0, 80) ?? null,
     h.country && /^[A-Z]{2}$/.test(h.country) ? h.country : null, ua.device, ua.browser, ua.os]);
  if (kind === "view") { await app.db.query("UPDATE profiles SET view_count = view_count + 1 WHERE user_id = $1", [ownerId]); bumpCachedViews(ownerId); }
  return { recorded: true };
}

export async function recordView(app: App, username: string, viewerId: string | null, h: Hit) {
  const o = await owner(app, username);
  if (viewerId === o.id) return { recorded: false, reason: "owner" };
  return record(app, o.id, "view", h, { dedupeSec: 1800 });
}

export async function recordClick(app: App, username: string, viewerId: string | null, linkId: string, h: Hit) {
  const o = await owner(app, username);
  const cfg = profileConfigSchema.parse(o.config);
  if (!cfg.links.some((l) => l.id === linkId)) throw new HttpError(404, "not_found", "Link not found");
  if (viewerId === o.id) return { recorded: false, reason: "owner" };
  return record(app, o.id, "click", h, { linkId, dedupeSec: 10 });
}

export async function recordPlay(app: App, username: string, viewerId: string | null, trackId: string, h: Hit) {
  const o = await owner(app, username);
  const cfg = profileConfigSchema.parse(o.config);
  if (!cfg.music.tracks.some((t) => t.id === trackId)) throw new HttpError(404, "not_found", "Track not found");
  if (viewerId === o.id) return { recorded: false, reason: "owner" };
  return record(app, o.id, "play", h, { linkId: trackId, dedupeSec: 60 });
}

// ------------------------------------------------------------------ reporting

export async function stats(app: App, userId: string, from: Date, to: Date) {
  const span = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - span);
  const p = [userId, from, to];
  const q = (sql: string, params = p) => app.db.query(sql, params).then((r) => r.rows);

  const [totals, prev, series, links, refs, utm, devices, browsers, oses, countries, plays] = await Promise.all([
    q(`SELECT count(*) FILTER (WHERE kind='view')::int AS views, count(DISTINCT visitor_hash) FILTER (WHERE kind='view')::int AS uniques,
              count(*) FILTER (WHERE kind='click')::int AS clicks, count(DISTINCT (visitor_hash, link_id)) FILTER (WHERE kind='click')::int AS unique_clicks,
              count(*) FILTER (WHERE kind='play')::int AS plays
       FROM analytics_events WHERE user_id = $1 AND at >= $2 AND at < $3`),
    q(`SELECT count(*) FILTER (WHERE kind='view')::int AS views, count(DISTINCT visitor_hash) FILTER (WHERE kind='view')::int AS uniques,
              count(*) FILTER (WHERE kind='click')::int AS clicks, count(*) FILTER (WHERE kind='play')::int AS plays
       FROM analytics_events WHERE user_id = $1 AND at >= $2 AND at < $3`, [userId, prevFrom, from]),
    q(`SELECT d::date AS day,
              (SELECT count(*) FROM analytics_events e WHERE e.user_id = $1 AND e.kind='view' AND e.at >= d AND e.at < d + interval '1 day')::int AS views,
              (SELECT count(DISTINCT visitor_hash) FROM analytics_events e WHERE e.user_id = $1 AND e.kind='view' AND e.at >= d AND e.at < d + interval '1 day')::int AS uniques,
              (SELECT count(*) FROM analytics_events e WHERE e.user_id = $1 AND e.kind='click' AND e.at >= d AND e.at < d + interval '1 day')::int AS clicks
       FROM generate_series(date_trunc('day', $2::timestamptz), $3::timestamptz - interval '1 second', interval '1 day') d ORDER BY d`),
    q(`SELECT link_id, count(*)::int AS clicks, count(DISTINCT visitor_hash)::int AS uniques FROM analytics_events
       WHERE user_id = $1 AND kind='click' AND at >= $2 AND at < $3 GROUP BY link_id ORDER BY clicks DESC LIMIT 30`),
    q(`SELECT COALESCE(referrer_host, 'direct') AS name, count(*)::int AS n FROM analytics_events WHERE user_id = $1 AND kind='view' AND at >= $2 AND at < $3 GROUP BY 1 ORDER BY n DESC LIMIT 15`),
    q(`SELECT utm_campaign AS campaign, utm_source AS source, utm_medium AS medium, count(*)::int AS n FROM analytics_events
       WHERE user_id = $1 AND kind='view' AND at >= $2 AND at < $3 AND (utm_campaign IS NOT NULL OR utm_source IS NOT NULL) GROUP BY 1,2,3 ORDER BY n DESC LIMIT 20`),
    q(`SELECT device AS name, count(*)::int AS n FROM analytics_events WHERE user_id = $1 AND kind='view' AND at >= $2 AND at < $3 GROUP BY 1 ORDER BY n DESC`),
    q(`SELECT browser AS name, count(*)::int AS n FROM analytics_events WHERE user_id = $1 AND kind='view' AND at >= $2 AND at < $3 GROUP BY 1 ORDER BY n DESC`),
    q(`SELECT os AS name, count(*)::int AS n FROM analytics_events WHERE user_id = $1 AND kind='view' AND at >= $2 AND at < $3 GROUP BY 1 ORDER BY n DESC`),
    q(`SELECT COALESCE(country, 'Unknown') AS name, count(*)::int AS n FROM analytics_events WHERE user_id = $1 AND kind='view' AND at >= $2 AND at < $3 GROUP BY 1 ORDER BY n DESC LIMIT 20`),
    q(`SELECT link_id AS track_id, count(*)::int AS n FROM analytics_events WHERE user_id = $1 AND kind='play' AND at >= $2 AND at < $3 GROUP BY 1 ORDER BY n DESC`),
  ]);
  const t = totals[0];
  const views = t.views || 0;
  return {
    range: { from, to }, totals: { ...t, ctr: views ? t.clicks / views : 0 }, previous: prev[0],
    series, links: links.map((l: any) => ({ ...l, ctr: views ? l.clicks / views : 0 })), referrers: refs, campaigns: utm,
    devices, browsers, os: oses, countries, plays,
    allTime: Number((await app.db.query("SELECT view_count FROM profiles WHERE user_id = $1", [userId])).rows[0]?.view_count ?? 0),
  };
}

export async function exportCsv(app: App, userId: string, from: Date, to: Date) {
  const rows = (await app.db.query(
    `SELECT at, kind, link_id, page, referrer_host, utm_source, utm_medium, utm_campaign, country, device, browser, os
     FROM analytics_events WHERE user_id = $1 AND at >= $2 AND at < $3 ORDER BY at LIMIT 100000`, [userId, from, to])).rows;
  const cols = ["at", "kind", "link_id", "page", "referrer_host", "utm_source", "utm_medium", "utm_campaign", "country", "device", "browser", "os"];
  const esc = (v: unknown) => { const s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v); return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export async function pruneAnalytics(app: App) {
  const { getSetting } = await import("../platform/service.ts");
  const days = await getSetting<number>(app, "analytics.retention_days", 400);
  await app.db.query("DELETE FROM analytics_events WHERE at < now() - make_interval(days => $1)", [days]);
  await app.db.query("DELETE FROM analytics_salts WHERE day < current_date - 2");
}
