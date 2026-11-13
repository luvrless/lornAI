/**
 * External integrations. Every result is fetched from the real provider and
 * cached; failures and missing credentials are reported as such. Nothing is
 * ever fabricated. Connected (OAuth) accounts are distinguished from
 * manually entered links via the `source` field.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { App } from "../../app.ts";
import { asJson } from "../../db/pg.ts";
import type { ProfileConfig } from "../../../shared/profile-schema.ts";
import { decrypt, encrypt } from "../../lib/crypto.ts";

export type IntegrationResult<T = unknown> =
  | { status: "ok"; source: "connected" | "public"; data: T; fetchedAt: string }
  | { status: "not_configured"; missing: string[] }
  | { status: "error"; error: string }
  | { status: "pending" };

const cacheOnlyCtx = new AsyncLocalStorage<boolean>();
/** Run fn with integrations restricted to cached data (used while rendering pages). */
export function withCacheOnly<T>(fn: () => Promise<T>): Promise<T> {
  return cacheOnlyCtx.run(true, fn);
}

const TTL: Record<string, number> = { github: 1800, roblox: 1800, steam: 900, twitch: 120, youtube: 1800, discordserver: 600, weather: 900, discord: 300 };

async function cached<T>(app: App, key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<IntegrationResult<T>> {
  const c = (await app.db.query("SELECT status, data, error, fetched_at FROM integration_cache WHERE key = $1 AND expires_at > now()", [key])).rows[0];
  if (c) return c.status === "ok" ? { status: "ok", source: "public", data: c.data, fetchedAt: c.fetched_at } : { status: "error", error: c.error };
  if (cacheOnlyCtx.getStore()) return { status: "pending" } as IntegrationResult<T>;
  try {
    const data = await fetcher();
    await app.db.query(
      `INSERT INTO integration_cache (key, status, data, fetched_at, expires_at) VALUES ($1,'ok',$2,now(),now() + make_interval(secs => $3))
       ON CONFLICT (key) DO UPDATE SET status = 'ok', data = EXCLUDED.data, error = NULL, fetched_at = now(), expires_at = EXCLUDED.expires_at`,
      [key, asJson(data), ttlSec]);
    return { status: "ok", source: "public", data, fetchedAt: new Date().toISOString() };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    // Short negative cache so a failing provider isn't hammered.
    await app.db.query(
      `INSERT INTO integration_cache (key, status, error, expires_at) VALUES ($1,'error',$2, now() + interval '2 minutes')
       ON CONFLICT (key) DO UPDATE SET status = 'error', error = EXCLUDED.error, data = NULL, fetched_at = now(), expires_at = EXCLUDED.expires_at`, [key, msg]);
    return { status: "error", error: msg };
  }
}

async function getJson(app: App, url: string, headers: Record<string, string> = {}) {
  const r = await app.fetch(url, { headers: { "User-Agent": "LORN.LOL (+https://lorn.lol)", Accept: "application/json", ...headers }, signal: AbortSignal.timeout(8000) });
  if (r.status === 404) throw new Error("Not found on provider");
  if (r.status === 429) throw new Error("Provider rate limit reached, try again later");
  if (!r.ok) throw new Error(`Provider responded ${r.status}`);
  return r.json() as Promise<any>;
}

export const providers = {
  github: (app: App, username: string) => cached(app, `github:${username.toLowerCase()}`, TTL.github, async () => {
    const h: Record<string, string> = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const u = await getJson(app, `https://api.github.com/users/${encodeURIComponent(username)}`, h);
    const repos = await getJson(app, `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100&type=owner`, h) as any[];
    const langs: Record<string, number> = {};
    for (const r of repos) if (r.language && !r.fork) langs[r.language] = (langs[r.language] ?? 0) + 1;
    return {
      login: u.login, name: u.name, avatar: u.avatar_url, bio: u.bio, followers: u.followers, publicRepos: u.public_repos, url: u.html_url,
      stars: repos.reduce((s, r) => s + (r.stargazers_count ?? 0), 0),
      languages: Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
      repos: repos.filter((r) => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 6)
        .map((r) => ({ name: r.name, description: r.description, stars: r.stargazers_count, language: r.language, url: r.html_url })),
    };
  }),

  roblox: (app: App, userId: string) => cached(app, `roblox:${userId}`, TTL.roblox, async () => {
    const u = await getJson(app, `https://users.roblox.com/v1/users/${userId}`);
    const thumb = await getJson(app, `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
    const friends = await getJson(app, `https://friends.roblox.com/v1/users/${userId}/friends/count`).catch(() => null);
    const followers = await getJson(app, `https://friends.roblox.com/v1/users/${userId}/followers/count`).catch(() => null);
    return {
      id: u.id, name: u.name, displayName: u.displayName, description: u.description, created: u.created, banned: u.isBanned,
      avatar: thumb?.data?.[0]?.imageUrl ?? null, friends: friends?.count ?? null, followers: followers?.count ?? null,
      url: `https://www.roblox.com/users/${u.id}/profile`,
    };
  }),

  steam: async (app: App, steamId: string): Promise<IntegrationResult> => {
    const key = process.env.STEAM_API_KEY;
    if (!key) return { status: "not_configured", missing: ["STEAM_API_KEY"] };
    return cached(app, `steam:${steamId}`, TTL.steam, async () => {
      const s = await getJson(app, `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`);
      const p = s.response?.players?.[0];
      if (!p) throw new Error("Steam profile not found");
      const recent = await getJson(app, `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${steamId}&count=5`).catch(() => ({ response: {} }));
      const owned = await getJson(app, `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&include_appinfo=1`).catch(() => ({ response: {} }));
      const games = (owned.response.games ?? []) as any[];
      return {
        name: p.personaname, avatar: p.avatarfull, url: p.profileurl, state: p.personastate, visibility: p.communityvisibilitystate === 3 ? "public" : "private",
        gameCount: owned.response.game_count ?? null,
        recent: (recent.response.games ?? []).map((g: any) => ({ appid: g.appid, name: g.name, hours2w: Math.round((g.playtime_2weeks ?? 0) / 6) / 10, icon: g.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg` : null })),
        top: games.sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 5).map((g) => ({ appid: g.appid, name: g.name, hours: Math.round(g.playtime_forever / 6) / 10 })),
      };
    });
  },

  twitch: async (app: App, login: string): Promise<IntegrationResult> => {
    const id = process.env.TWITCH_CLIENT_ID, secret = process.env.TWITCH_CLIENT_SECRET;
    if (!id || !secret) return { status: "not_configured", missing: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"] };
    return cached(app, `twitch:${login.toLowerCase()}`, TTL.twitch, async () => {
      const tok = await app.fetch("https://id.twitch.tv/oauth2/token", { method: "POST", body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }), signal: AbortSignal.timeout(8000) }).then((r) => r.json()) as any;
      if (!tok.access_token) throw new Error("Twitch rejected the app credentials");
      const h = { "Client-Id": id, Authorization: `Bearer ${tok.access_token}` };
      const u = (await getJson(app, `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, h)).data?.[0];
      if (!u) throw new Error("Twitch channel not found");
      const s = (await getJson(app, `https://api.twitch.tv/helix/streams?user_id=${u.id}`, h)).data?.[0];
      return { login: u.login, name: u.display_name, avatar: u.profile_image_url, description: u.description, live: !!s, title: s?.title ?? null, game: s?.game_name ?? null, viewers: s?.viewer_count ?? null, url: `https://twitch.tv/${u.login}` };
    });
  },

  youtube: async (app: App, channelId: string): Promise<IntegrationResult> => {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return { status: "not_configured", missing: ["YOUTUBE_API_KEY"] };
    return cached(app, `youtube:${channelId}`, TTL.youtube, async () => {
      const c = (await getJson(app, `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${key}`)).items?.[0];
      if (!c) throw new Error("YouTube channel not found");
      const uploads = c.contentDetails?.relatedPlaylists?.uploads;
      const vids = uploads ? (await getJson(app, `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=4&playlistId=${uploads}&key=${key}`)).items ?? [] : [];
      return {
        title: c.snippet.title, avatar: c.snippet.thumbnails?.default?.url, subscribers: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount),
        views: Number(c.statistics.viewCount), videos: Number(c.statistics.videoCount), url: `https://youtube.com/channel/${channelId}`,
        latest: vids.map((v: any) => ({ id: v.snippet.resourceId.videoId, title: v.snippet.title, thumb: v.snippet.thumbnails?.medium?.url })),
      };
    });
  },

  discordserver: (app: App, invite: string) => cached(app, `discordinv:${invite}`, TTL.discordserver, async () => {
    const base = app.cfg.discord?.apiBase ?? "https://discord.com/api/v10";
    const i = await getJson(app, `${base}/invites/${encodeURIComponent(invite)}?with_counts=true`);
    return {
      name: i.guild?.name, icon: i.guild?.icon ? `https://cdn.discordapp.com/icons/${i.guild.id}/${i.guild.icon}.png` : null,
      members: i.approximate_member_count ?? null, online: i.approximate_presence_count ?? null, url: `https://discord.gg/${invite}`,
    };
  }),

  weather: (app: App, lat: number, lon: number) => cached(app, `weather:${lat.toFixed(2)},${lon.toFixed(2)}`, TTL.weather, async () => {
    const w = await getJson(app, `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,is_day`);
    return { temperatureC: w.current.temperature_2m, code: w.current.weather_code, windKmh: w.current.wind_speed_10m, isDay: !!w.current.is_day, time: w.current.time };
  }),
};

/** The connected Discord account (from OAuth), never a manually typed handle. */
async function discordConnected(app: App, userId: string): Promise<IntegrationResult> {
  const r = (await app.db.query("SELECT provider_user_id, provider_username, provider_avatar, updated_at FROM oauth_accounts WHERE user_id = $1 AND provider = 'discord'", [userId])).rows[0];
  if (!r) return { status: "error", error: "No Discord account connected" };
  return { status: "ok", source: "connected", data: { id: r.provider_user_id, username: r.provider_username, avatar: r.provider_avatar }, fetchedAt: r.updated_at };
}

/** Resolve live data for every integration-backed widget in a config. */
export async function resolveWidgetData(app: App, userId: string, cfg: ProfileConfig, opts: { cacheOnly?: boolean } = {}): Promise<Record<string, unknown>> {
  if (opts.cacheOnly && !cacheOnlyCtx.getStore()) return withCacheOnly(() => resolveWidgetData(app, userId, cfg));
  const out: Record<string, unknown> = {};
  const all = [...cfg.widgets, ...cfg.pages.flatMap((p) => p.widgets)];
  await Promise.all(all.map(async (w) => {
    const c = w.config as any;
    let r: IntegrationResult | null = null;
    if (w.type === "github" && c.username) r = await providers.github(app, c.username);
    else if (w.type === "roblox" && c.userId) r = await providers.roblox(app, c.userId);
    else if (w.type === "steam" && c.steamId) r = await providers.steam(app, c.steamId);
    else if (w.type === "twitch" && c.login) r = await providers.twitch(app, c.login);
    else if (w.type === "youtube" && c.channelId) r = await providers.youtube(app, c.channelId);
    else if (w.type === "discordserver" && c.invite) r = await providers.discordserver(app, c.invite);
    else if (w.type === "weather" && c.latitude != null && c.longitude != null) r = await providers.weather(app, c.latitude, c.longitude);
    else if (w.type === "discord") r = await discordConnected(app, userId);
    if (r) out[w.id] = r;
  }));
  return out;
}

export function integrationStatus() {
  return {
    github: process.env.GITHUB_TOKEN ? "configured (authenticated, 5000 req/h)" : "public API (60 req/h per server IP); set GITHUB_TOKEN for higher limits",
    roblox: "public API, no key required",
    steam: process.env.STEAM_API_KEY ? "configured" : "not_configured: set STEAM_API_KEY",
    twitch: process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET ? "configured" : "not_configured: set TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET",
    youtube: process.env.YOUTUBE_API_KEY ? "configured" : "not_configured: set YOUTUBE_API_KEY",
    spotify: "embeds only (official iframe); now-playing needs SPOTIFY_CLIENT_ID/SECRET — not implemented",
    weather: "Open-Meteo public API, no key required",
    discordInvites: "public invite API",
  };
}

export async function healthCheck(app: App) {
  const rows = (await app.db.query("SELECT split_part(key, ':', 1) AS provider, count(*) FILTER (WHERE status = 'ok')::int AS ok, count(*) FILTER (WHERE status = 'error')::int AS errors, max(fetched_at) AS last FROM integration_cache WHERE fetched_at > now() - interval '24 hours' GROUP BY 1")).rows;
  return { config: integrationStatus(), last24h: rows };
}

export { encrypt, decrypt };
