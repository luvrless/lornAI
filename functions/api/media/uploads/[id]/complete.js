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
  const id = context.params.id;
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  const username = user?.username ? user.username.toLowerCase() : "guest";

  let meta = {
    id,
    name: "upload",
    mime: "image/png",
    bytes: 0,
    kind: "image",
    created_at: new Date().toISOString()
  };

  if (context.env?.LORNAI_KV && id) {
    try {
      const pendingRaw = await context.env.LORNAI_KV.get(`pending_upload:${id}`);
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);
        meta.name = pending.name || meta.name;
        meta.mime = pending.mime || meta.mime;
        meta.bytes = pending.size || meta.bytes;
        meta.kind = pending.kind || meta.kind;
        meta.created_at = pending.createdAt || meta.created_at;
      }
    } catch {}
  }

  const asset = {
    id,
    name: meta.name,
    kind: meta.kind,
    url: `/api/media/raw/${id}`,
    thumbUrl: `/api/media/raw/${id}`,
    bytes: meta.bytes,
    mime: meta.mime,
    created_at: meta.created_at
  };

  if (context.env?.LORNAI_KV && id) {
    try {
      await context.env.LORNAI_KV.put(`asset:${id}`, JSON.stringify(asset));

      // Append to user's assets
      let assets = [];
      const userAssetsRaw = await context.env.LORNAI_KV.get(`user_assets:${username}`);
      if (userAssetsRaw) {
        assets = JSON.parse(userAssetsRaw);
      }
      if (!assets.includes(id)) {
        assets.unshift(id);
        await context.env.LORNAI_KV.put(`user_assets:${username}`, JSON.stringify(assets));
      }

      // Update storage
      const currUsed = Number(await context.env.LORNAI_KV.get(`storage:${username}`)) || 0;
      await context.env.LORNAI_KV.put(`storage:${username}`, String(currUsed + meta.bytes));
    } catch {}
  }

  return new Response(JSON.stringify(asset), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
