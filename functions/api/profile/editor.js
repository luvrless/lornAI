import { DEFAULT_CONFIG } from './default-config.js';

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
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  if (!user?.username) user = { id: "usr_guest", uid: 1, username: "you" };

  let draft = structuredClone(DEFAULT_CONFIG);
  draft.identity.displayName = user.username;

  // Try to load from KV first
  if (context.env?.LORNAI_KV && user.username) {
    try {
      const kvData = await context.env.LORNAI_KV.get(`profile:${user.username.toLowerCase()}`);
      if (kvData) {
        draft = mergeConfigs(DEFAULT_CONFIG, JSON.parse(kvData));
      }
    } catch {}
  }

  let isPublished = false;
  if (context.env?.LORNAI_KV && user.username) {
    try {
      const pub = await context.env.LORNAI_KV.get(`published:${user.username.toLowerCase()}`);
      if (pub === "true") isPublished = true;
    } catch {}
  }

  return new Response(JSON.stringify({
    app: "lorn",
    user: { id: user.id },
    draft,
    rev: 1,
    isPublished,
    publishedVersion: isPublished ? 1 : null,
    hasUnpublishedChanges: false,
    premiumBlocked: [],
    moderationHidden: false
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
