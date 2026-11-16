import { DEFAULT_CONFIG } from '../profile/default-config.js';
import { ALL_BADGES } from '../badges/catalogue.js';

function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const val = rest.join('=').trim();
    try { list[name] = decodeURIComponent(val); } catch { list[name] = val; }
  });
  return list;
}

function decodeToken(token) {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const jsonStr = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}

function mergeConfigs(base, override) {
  if (!override || typeof override !== 'object') return structuredClone(base);
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = mergeConfigs(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export async function onRequestGet(context) {
  const username = (context.params.username || "").toLowerCase();

  function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  let user = null;
  if (context.env?.LORNAI_KV) {
    try {
      const rawUser = await context.env.LORNAI_KV.get(`user:${username}`);
      if (rawUser) user = JSON.parse(rawUser);
    } catch {}
  }

  // Fallback demo user if accessing sample username
  if (!user && (username === "alice" || username === "neon" || username === "luna" || username === "demo")) {
    user = {
      id: "usr_" + username,
      uid: 10001,
      username,
      displayName: username.charAt(0).toUpperCase() + username.slice(1),
      createdAt: new Date().toISOString()
    };
  }

  if (!user) {
    return json({ error: "not_found" }, 404);
  }

  // Check if visitor is the profile owner viewing their own profile
  const cookieHeader = context.request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const sessionUser = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  const isOwner = sessionUser?.username && sessionUser.username.toLowerCase() === username;

  // View count with per-person / device deduplication (IP + User-Agent within 24h window)
  let views = 0;
  if (context.env?.LORNAI_KV) {
    try {
      const v = await context.env.LORNAI_KV.get(`views:${username}`);
      views = Number(v) || 0;

      if (!isOwner) {
        const ip = context.request.headers.get("cf-connecting-ip") || context.request.headers.get("x-real-ip") || "unknown";
        const ua = (context.request.headers.get("user-agent") || "").slice(0, 80);
        const viewerHash = hashString(ip + ":" + ua);
        const dedupeKey = `viewed:${username}:${viewerHash}`;

        const alreadyViewed = await context.env.LORNAI_KV.get(dedupeKey);
        if (!alreadyViewed) {
          views += 1;
          await context.env.LORNAI_KV.put(`views:${username}`, String(views));
          await context.env.LORNAI_KV.put(dedupeKey, "1", { expirationTtl: 86400 });

          // Also increment global platform views
          const gv = Number(await context.env.LORNAI_KV.get("stats:views")) || 2840;
          await context.env.LORNAI_KV.put("stats:views", String(gv + 1));
        }
      }
    } catch {}
  }

  // Check published status and load config
  let isPublished = false;
  let config = structuredClone(DEFAULT_CONFIG);
  config.identity.displayName = user.displayName || user.username;

  if (context.env?.LORNAI_KV) {
    try {
      const pub = await context.env.LORNAI_KV.get(`published:${username}`);
      if (pub === "true") isPublished = true;

      const kvConfig = await context.env.LORNAI_KV.get(`published_config:${username}`) || await context.env.LORNAI_KV.get(`profile:${username}`);
      if (kvConfig) {
        config = mergeConfigs(DEFAULT_CONFIG, JSON.parse(kvConfig));
      }
    } catch {}
  }

  // Load assets
  const assets = {};
  if (context.env?.LORNAI_KV) {
    try {
      const assetIdsRaw = await context.env.LORNAI_KV.get(`user_assets:${username}`);
      if (assetIdsRaw) {
        const ids = JSON.parse(assetIdsRaw);
        for (const id of ids) {
          const aRaw = await context.env.LORNAI_KV.get(`asset:${id}`);
          if (aRaw) assets[id] = JSON.parse(aRaw);
        }
      }
    } catch {}
  }

  // Badges
  let userOwned = ["og", "early_supporter"];
  let hiddenKeys = [];
  if (context.env?.LORNAI_KV) {
    try {
      const stored = await context.env.LORNAI_KV.get(`badges:${username}`);
      if (stored) userOwned = JSON.parse(stored);
      const hiddenStored = await context.env.LORNAI_KV.get(`badges_hidden:${username}`);
      if (hiddenStored) hiddenKeys = JSON.parse(hiddenStored);
    } catch {}
  }

  const badges = ALL_BADGES
    .filter(b => userOwned.includes(b.key) && !hiddenKeys.includes(b.key))
    .map(b => ({
      id: b.id,
      key: b.key,
      name: b.name,
      tooltip: b.tooltip || b.name,
      iconUrl: b.iconUrl || null,
      iconPreset: b.iconPreset || null,
      color: b.color || "#ffffff",
      gradientFrom: b.gradientFrom || null,
      gradientTo: b.gradientTo || null,
      borderColor: b.borderColor || null,
      glow: b.glow || 20,
      hover: b.hover || "lift"
    }));

  return json({
    status: "ok",
    payload: {
      user: {
        uid: user.uid || 10420,
        username: user.username,
        createdAt: user.createdAt || new Date().toISOString(),
        premium: false,
        verified: false
      },
      config,
      assets,
      badges,
      views,
      integrations: {},
      mode: isPublished ? "published" : "starter"
    }
  });
}
