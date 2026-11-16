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

export async function onRequestPost(context) {
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  const username = user?.username || "you";

  if (context.env?.LORNAI_KV && username) {
    try {
      await context.env.LORNAI_KV.put(`published:${username.toLowerCase()}`, "true");

      // Copy the draft as the published config
      const draft = await context.env.LORNAI_KV.get(`profile:${username.toLowerCase()}`);
      if (draft) {
        await context.env.LORNAI_KV.put(`published_config:${username.toLowerCase()}`, draft);
      }

      const currLive = Number(await context.env.LORNAI_KV.get("stats:live")) || 98;
      await context.env.LORNAI_KV.put("stats:live", String(currLive + 1));
    } catch {}
  }

  return new Response(JSON.stringify({
    app: "lorn",
    ok: true,
    version: 1,
    publishedAt: new Date().toISOString()
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
