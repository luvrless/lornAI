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
  const username = user?.username ? user.username.toLowerCase() : "guest";

  const body = await context.request.json().catch(() => ({}));
  const uploadId = "ast_" + Math.random().toString(36).slice(2, 10);

  const pending = {
    id: uploadId,
    name: body.filename || "file",
    mime: body.mime || "application/octet-stream",
    size: body.size || 0,
    kind: body.kind || "image",
    username,
    createdAt: new Date().toISOString()
  };

  if (context.env?.LORNAI_KV) {
    try {
      await context.env.LORNAI_KV.put(`pending_upload:${uploadId}`, JSON.stringify(pending), { expirationTtl: 3600 });
    } catch {}
  }

  return new Response(JSON.stringify({
    app: "lorn",
    uploadId,
    target: {
      url: `/api/media/binary/${uploadId}`,
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream"
      }
    }
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
