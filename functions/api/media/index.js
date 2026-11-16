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

  let items = [];
  if (context.env?.LORNAI_KV && username) {
    try {
      const assetIdsRaw = await context.env.LORNAI_KV.get(`user_assets:${username}`);
      if (assetIdsRaw) {
        const ids = JSON.parse(assetIdsRaw);
        for (const id of ids) {
          const aRaw = await context.env.LORNAI_KV.get(`asset:${id}`);
          if (aRaw) items.push(JSON.parse(aRaw));
        }
      }
    } catch {}
  }

  return new Response(JSON.stringify({
    app: "lorn",
    items,
    total: items.length
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
