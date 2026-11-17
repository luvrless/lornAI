import type { Adapter, Finding } from "../../types";
import { fetchWithTimeout } from "../http";
import { entityFinding, mkFinding } from "../util";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Platform = {
  id: string;
  name: string;
  category: string;
  url: (u: string) => string;
  // JSON-API based check (preferred, most reliable)
  json?: {
    exists: (data: unknown) => boolean;
    meta?: (data: unknown) => Record<string, string>;
  };
  // page-status based check
  profile?: (u: string) => string; // link to show user
};

const g = (o: unknown, k: string): unknown =>
  o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined;

const PLATFORMS: Platform[] = [
  {
    id: "github", name: "GitHub", category: "developer",
    url: (u) => `https://api.github.com/users/${encodeURIComponent(u)}`,
    profile: (u) => `https://github.com/${u}`,
    json: {
      exists: (d) => !!g(d, "login"),
      meta: (d) => ({
        name: String(g(d, "name") ?? ""),
        bio: String(g(d, "bio") ?? ""),
        repos: String(g(d, "public_repos") ?? ""),
        created: String(g(d, "created_at") ?? ""),
      }),
    },
  },
  {
    id: "reddit", name: "Reddit", category: "social",
    url: (u) => `https://www.reddit.com/user/${encodeURIComponent(u)}/about.json`,
    profile: (u) => `https://reddit.com/user/${u}`,
    json: {
      exists: (d) => !!g(g(d, "data"), "name"),
      meta: (d) => ({
        karma: String(g(g(d, "data"), "total_karma") ?? ""),
        created: String(g(g(d, "data"), "created_utc") ?? ""),
      }),
    },
  },
  {
    id: "hackernews", name: "Hacker News", category: "forum",
    url: (u) => `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(u)}.json`,
    profile: (u) => `https://news.ycombinator.com/user?id=${u}`,
    json: {
      exists: (d) => d !== null && !!g(d, "id"),
      meta: (d) => ({ karma: String(g(d, "karma") ?? ""), created: String(g(d, "created") ?? "") }),
    },
  },
  {
    id: "dockerhub", name: "Docker Hub", category: "developer",
    url: (u) => `https://hub.docker.com/v2/users/${encodeURIComponent(u)}/`,
    profile: (u) => `https://hub.docker.com/u/${u}`,
    json: {
      exists: (d) => !!g(d, "username"),
      meta: (d) => ({ fullName: String(g(d, "full_name") ?? ""), joined: String(g(d, "date_joined") ?? "") }),
    },
  },
  {
    id: "chesscom", name: "Chess.com", category: "social",
    url: (u) => `https://api.chess.com/pub/player/${encodeURIComponent(u)}`,
    profile: (u) => `https://chess.com/member/${u}`,
    json: {
      exists: (d) => !!g(d, "player_id"),
      meta: (d) => ({ name: String(g(d, "name") ?? ""), country: String(g(d, "country") ?? ""), joined: String(g(d, "joined") ?? "") }),
    },
  },
  // Page-status based (404 ⇒ not found, 200 ⇒ found, else inconclusive)
  { id: "gitlab", name: "GitLab", category: "developer", url: (u) => `https://gitlab.com/${encodeURIComponent(u)}`, profile: (u) => `https://gitlab.com/${u}` },
  { id: "pypi", name: "PyPI", category: "package_registry", url: (u) => `https://pypi.org/user/${encodeURIComponent(u)}/`, profile: (u) => `https://pypi.org/user/${u}/` },
  { id: "npm", name: "npm", category: "package_registry", url: (u) => `https://www.npmjs.com/~${encodeURIComponent(u)}`, profile: (u) => `https://www.npmjs.com/~${u}` },
  { id: "twitch", name: "Twitch", category: "social", url: (u) => `https://m.twitch.tv/${encodeURIComponent(u)}`, profile: (u) => `https://twitch.tv/${u}` },
  { id: "steam", name: "Steam", category: "social", url: (u) => `https://steamcommunity.com/id/${encodeURIComponent(u)}`, profile: (u) => `https://steamcommunity.com/id/${u}` },
  { id: "keybase", name: "Keybase", category: "developer", url: (u) => `https://keybase.io/${encodeURIComponent(u)}`, profile: (u) => `https://keybase.io/${u}` },
  { id: "medium", name: "Medium", category: "social", url: (u) => `https://medium.com/@${encodeURIComponent(u)}`, profile: (u) => `https://medium.com/@${u}` },
  { id: "devto", name: "Dev.to", category: "developer", url: (u) => `https://dev.to/${encodeURIComponent(u)}`, profile: (u) => `https://dev.to/${u}` },
  { id: "replit", name: "Replit", category: "developer", url: (u) => `https://replit.com/@${encodeURIComponent(u)}`, profile: (u) => `https://replit.com/@${u}` },
  { id: "pinterest", name: "Pinterest", category: "social", url: (u) => `https://www.pinterest.com/${encodeURIComponent(u)}/`, profile: (u) => `https://pinterest.com/${u}` },
  { id: "soundcloud", name: "SoundCloud", category: "social", url: (u) => `https://soundcloud.com/${encodeURIComponent(u)}`, profile: (u) => `https://soundcloud.com/${u}` },
  { id: "vimeo", name: "Vimeo", category: "social", url: (u) => `https://vimeo.com/${encodeURIComponent(u)}`, profile: (u) => `https://vimeo.com/${u}` },
  { id: "tumblr", name: "Tumblr", category: "social", url: (u) => `https://${encodeURIComponent(u)}.tumblr.com`, profile: (u) => `https://${u}.tumblr.com` },
  { id: "behance", name: "Behance", category: "social", url: (u) => `https://www.behance.net/${encodeURIComponent(u)}`, profile: (u) => `https://behance.net/${u}` },
  { id: "dribbble", name: "Dribbble", category: "social", url: (u) => `https://dribbble.com/${encodeURIComponent(u)}`, profile: (u) => `https://dribbble.com/${u}` },
  { id: "flickr", name: "Flickr", category: "social", url: (u) => `https://www.flickr.com/people/${encodeURIComponent(u)}`, profile: (u) => `https://flickr.com/people/${u}` },
  { id: "kaggle", name: "Kaggle", category: "developer", url: (u) => `https://www.kaggle.com/${encodeURIComponent(u)}`, profile: (u) => `https://kaggle.com/${u}` },
  { id: "huggingface", name: "Hugging Face", category: "developer", url: (u) => `https://huggingface.co/${encodeURIComponent(u)}`, profile: (u) => `https://huggingface.co/${u}` },
  { id: "codeberg", name: "Codeberg", category: "developer", url: (u) => `https://codeberg.org/${encodeURIComponent(u)}`, profile: (u) => `https://codeberg.org/${u}` },
  { id: "producthunt", name: "Product Hunt", category: "social", url: (u) => `https://www.producthunt.com/@${encodeURIComponent(u)}`, profile: (u) => `https://producthunt.com/@${u}` },
  { id: "aboutme", name: "About.me", category: "social", url: (u) => `https://about.me/${encodeURIComponent(u)}`, profile: (u) => `https://about.me/${u}` },
  { id: "patreon", name: "Patreon", category: "social", url: (u) => `https://www.patreon.com/${encodeURIComponent(u)}`, profile: (u) => `https://patreon.com/${u}` },
  { id: "lastfm", name: "Last.fm", category: "social", url: (u) => `https://www.last.fm/user/${encodeURIComponent(u)}`, profile: (u) => `https://last.fm/user/${u}` },
  { id: "telegram", name: "Telegram", category: "social", url: (u) => `https://t.me/${encodeURIComponent(u)}`, profile: (u) => `https://t.me/${u}` },
  { id: "wordpress", name: "WordPress.com", category: "social", url: (u) => `https://${encodeURIComponent(u)}.wordpress.com`, profile: (u) => `https://${u}.wordpress.com` },
  { id: "gravatar", name: "Gravatar", category: "social", url: (u) => `https://gravatar.com/${encodeURIComponent(u)}`, profile: (u) => `https://gravatar.com/${u}` },
  { id: "substack", name: "Substack", category: "social", url: (u) => `https://${encodeURIComponent(u)}.substack.com`, profile: (u) => `https://${u}.substack.com` },
  { id: "linktree", name: "Linktree", category: "social", url: (u) => `https://linktr.ee/${encodeURIComponent(u)}`, profile: (u) => `https://linktr.ee/${u}` },
  { id: "buymeacoffee", name: "Buy Me a Coffee", category: "social", url: (u) => `https://www.buymeacoffee.com/${encodeURIComponent(u)}`, profile: (u) => `https://www.buymeacoffee.com/${u}` },
  { id: "bandcamp", name: "Bandcamp", category: "social", url: (u) => `https://${encodeURIComponent(u)}.bandcamp.com`, profile: (u) => `https://${u}.bandcamp.com` },
  { id: "itchio", name: "itch.io", category: "developer", url: (u) => `https://${encodeURIComponent(u)}.itch.io`, profile: (u) => `https://${u}.itch.io` },
  { id: "threads", name: "Threads", category: "social", url: (u) => `https://www.threads.net/@${encodeURIComponent(u)}`, profile: (u) => `https://www.threads.net/@${u}` },
  { id: "letterboxd", name: "Letterboxd", category: "social", url: (u) => `https://letterboxd.com/${encodeURIComponent(u)}/`, profile: (u) => `https://letterboxd.com/${u}` },
  { id: "myanimelist", name: "MyAnimeList", category: "social", url: (u) => `https://myanimelist.net/profile/${encodeURIComponent(u)}`, profile: (u) => `https://myanimelist.net/profile/${u}` },
  { id: "deviantart", name: "DeviantArt", category: "social", url: (u) => `https://www.deviantart.com/${encodeURIComponent(u)}`, profile: (u) => `https://www.deviantart.com/${u}` },
  { id: "kickstarter", name: "Kickstarter", category: "social", url: (u) => `https://www.kickstarter.com/profile/${encodeURIComponent(u)}`, profile: (u) => `https://www.kickstarter.com/profile/${u}` },
  { id: "trakt", name: "Trakt.tv", category: "social", url: (u) => `https://trakt.tv/users/${encodeURIComponent(u)}`, profile: (u) => `https://trakt.tv/users/${u}` },
  { id: "paypal", name: "PayPal.Me", category: "social", url: (u) => `https://www.paypal.com/paypalme/${encodeURIComponent(u)}`, profile: (u) => `https://www.paypal.com/paypalme/${u}` },
  { id: "cashapp", name: "Cash App", category: "social", url: (u) => `https://cash.app/$${encodeURIComponent(u)}`, profile: (u) => `https://cash.app/$${u}` },
  { id: "mastodon", name: "Mastodon.social", category: "social", url: (u) => `https://mastodon.social/@${encodeURIComponent(u)}`, profile: (u) => `https://mastodon.social/@${u}` },
];

async function checkPlatform(
  p: Platform,
  user: string,
  signal: AbortSignal
): Promise<Finding> {
  const url = p.url(user);
  const base = {
    key: `account_${p.id}`,
    label: p.name,
    sourceUrl: p.profile ? p.profile(user) : url,
    categories: [p.category],
  };
  try {
    const res = await fetchWithTimeout(url, {
      signal,
      timeoutMs: 9000,
      redirect: "follow",
      headers: { "user-agent": BROWSER_UA, accept: "application/json,text/html,*/*" },
    });
    if (res.status === 429) {
      return entityFinding("username-enum", base.key, base.label, `${p.name}: rate limited`, "url", 0.3, base.sourceUrl);
    }
    if (p.json) {
      if (res.status === 404) {
        return { sourceId: "username-enum", ...base, value: `${p.name}: not found`, confidence: 0.85, collectedAt: new Date().toISOString(), extra: { status: "not_found" } };
      }
      if (!res.ok) {
        return { sourceId: "username-enum", ...base, value: `${p.name}: inconclusive (HTTP ${res.status})`, confidence: 0.3, collectedAt: new Date().toISOString(), extra: { status: "inconclusive" } };
      }
      let data: unknown = null;
      try { data = await res.json(); } catch { /* */ }
      const exists = p.json.exists(data);
      const meta = exists && p.json.meta ? p.json.meta(data) : {};
      return {
        sourceId: "username-enum",
        ...base,
        value: exists ? `${p.name}: FOUND` : `${p.name}: not found`,
        entityType: exists ? "url" : undefined,
        confidence: exists ? 0.9 : 0.85,
        collectedAt: new Date().toISOString(),
        extra: { status: exists ? "found" : "not_found", ...meta },
      };
    }
    // page-status strategy
    if (res.status === 404 || res.status === 410) {
      return { sourceId: "username-enum", ...base, value: `${p.name}: not found`, confidence: 0.75, collectedAt: new Date().toISOString(), extra: { status: "not_found" } };
    }
    if (res.status >= 200 && res.status < 300) {
      return { sourceId: "username-enum", ...base, value: `${p.name}: FOUND`, entityType: "url", confidence: 0.75, collectedAt: new Date().toISOString(), extra: { status: "found" } };
    }
    return { sourceId: "username-enum", ...base, value: `${p.name}: inconclusive (HTTP ${res.status})`, confidence: 0.3, collectedAt: new Date().toISOString(), extra: { status: "inconclusive" } };
  } catch (e) {
    return { sourceId: "username-enum", ...base, value: `${p.name}: unavailable`, confidence: 0.2, collectedAt: new Date().toISOString(), extra: { status: "unavailable", error: (e as Error).message } };
  }
}

// simple concurrency pool
async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export const usernameAdapter: Adapter = {
  meta: {
    id: "username-enum",
    name: "Username Discovery",
    category: "username",
    description:
      "Checks whether a username exists across 30+ public platforms using official APIs and public profile pages. HTTP/blocking errors are never treated as 'not found'.",
    status: "integrated",
    supports: ["username"],
    authRequired: false,
    privacy: "public",
    rateLimit: "Per-platform public limits apply",
  },
  canRun: ({ identifierType }) => identifierType === "username",
  async run({ normalized, signal }) {
    const results = await pool(PLATFORMS, 8, (p) => checkPlatform(p, normalized, signal));
    const found = results.filter((r) => r.extra?.status === "found");
    const summary = mkFinding("username-enum", {
      key: "summary",
      label: "Accounts found",
      value: `${found.length} of ${PLATFORMS.length} platforms matched`,
      confidence: 0.9,
    });
    return {
      state: found.length ? "completed" : "no_results",
      findings: [summary, ...results],
      message: `${found.length} found / ${PLATFORMS.length} checked`,
      raw: { checked: PLATFORMS.length, found: found.length },
    };
  },
};
