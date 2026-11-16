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
  if (!user?.username) user = { id: "usr_guest", username: "you" };

  let isPublished = false;
  if (context.env?.LORNAI_KV && user.username) {
    try {
      const pub = await context.env.LORNAI_KV.get(`published:${user.username.toLowerCase()}`);
      if (pub === "true") isPublished = true;
    } catch {}
  }

  return new Response(JSON.stringify({
    app: "lorn",
    isPublished,
    hasUnpublishedChanges: false,
    publishedAt: isPublished ? new Date().toISOString() : null,
    moderationHidden: false
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
