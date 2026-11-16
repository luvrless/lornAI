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

export async function onRequestDelete(context) {
  const id = context.params.id;
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  const username = user?.username ? user.username.toLowerCase() : "";

  if (context.env?.LORNAI_KV && id && username) {
    try {
      await context.env.LORNAI_KV.delete(`asset:${id}`);
      await context.env.LORNAI_KV.delete(`raw_asset:${id}`);

      const userAssetsRaw = await context.env.LORNAI_KV.get(`user_assets:${username}`);
      if (userAssetsRaw) {
        let ids = JSON.parse(userAssetsRaw);
        ids = ids.filter(x => x !== id);
        await context.env.LORNAI_KV.put(`user_assets:${username}`, JSON.stringify(ids));
      }
    } catch {}
  }

  return new Response(JSON.stringify({ app: "lorn", ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function onRequestPatch(context) {
  const id = context.params.id;
  const body = await context.request.json().catch(() => ({}));

  if (context.env?.LORNAI_KV && id) {
    try {
      const aRaw = await context.env.LORNAI_KV.get(`asset:${id}`);
      if (aRaw) {
        const asset = JSON.parse(aRaw);
        if (body.name) asset.name = body.name;
        await context.env.LORNAI_KV.put(`asset:${id}`, JSON.stringify(asset));
      }
    } catch {}
  }

  return new Response(JSON.stringify({ app: "lorn", ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
