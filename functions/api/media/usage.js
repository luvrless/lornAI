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

  let usedBytes = 0;
  let byKind = [];
  if (context.env?.LORNAI_KV && username) {
    try {
      const u = await context.env.LORNAI_KV.get(`storage:${username}`);
      if (u) usedBytes = Number(u) || 0;

      const userAssetsRaw = await context.env.LORNAI_KV.get(`user_assets:${username}`);
      if (userAssetsRaw) {
        const ids = JSON.parse(userAssetsRaw);
        let imgCount = 0, imgBytes = 0;
        let audCount = 0, audBytes = 0;
        let vidCount = 0, vidBytes = 0;

        for (const id of ids) {
          const aRaw = await context.env.LORNAI_KV.get(`asset:${id}`);
          if (aRaw) {
            const a = JSON.parse(aRaw);
            if (a.kind === "audio") { audCount++; audBytes += a.bytes || 0; }
            else if (a.kind === "video") { vidCount++; vidBytes += a.bytes || 0; }
            else { imgCount++; imgBytes += a.bytes || 0; }
          }
        }
        if (imgCount) byKind.push({ kind: "image", count: imgCount, bytes: imgBytes });
        if (audCount) byKind.push({ kind: "audio", count: audCount, bytes: audBytes });
        if (vidCount) byKind.push({ kind: "video", count: vidCount, bytes: vidBytes });
      }
    } catch {}
  }

  return new Response(JSON.stringify({
    app: "lorn",
    usedBytes,
    quotaBytes: 104857600,
    byKind
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
