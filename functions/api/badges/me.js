import { ALL_BADGES } from './catalogue.js';

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

export async function onRequestGet(context) {
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  const username = user?.username ? user.username.toLowerCase() : "";

  let userOwned = ["og", "early_supporter"];
  let hiddenKeys = [];
  if (context.env?.LORNAI_KV && username) {
    try {
      const stored = await context.env.LORNAI_KV.get(`badges:${username}`);
      if (stored) userOwned = JSON.parse(stored);

      const hiddenStored = await context.env.LORNAI_KV.get(`badges_hidden:${username}`);
      if (hiddenStored) hiddenKeys = JSON.parse(hiddenStored);
    } catch {}
  }

  const badges = ALL_BADGES
    .filter(b => userOwned.includes(b.key))
    .map(b => ({
      ...b,
      hidden: hiddenKeys.includes(b.key),
      acquiredAt: user?.createdAt || new Date().toISOString()
    }));

  return new Response(JSON.stringify({
    app: "lorn",
    badges,
    credits: 0,
    customRequests: []
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function onRequestPut(context) {
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  const username = user?.username ? user.username.toLowerCase() : "";

  try {
    const body = await context.request.json().catch(() => ({}));
    if (context.env?.LORNAI_KV && username) {
      if (body.hidden) {
        await context.env.LORNAI_KV.put(`badges_hidden:${username}`, JSON.stringify(body.hidden));
      }
    }
  } catch {}

  return new Response(JSON.stringify({ app: "lorn", ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
