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
  const cookieHeader = context.request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const token = cookies.lorn_session;

  if (token) {
    let user = decodeToken(token);
    if (user && user.username) {
      let connections = [];
      // If KV has updated info for user, refresh it
      if (context.env?.LORNAI_KV) {
        try {
          const kvRaw = await context.env.LORNAI_KV.get(`user:${user.username.toLowerCase()}`);
          if (kvRaw) {
            const stored = JSON.parse(kvRaw);
            user = {
              id: stored.id || user.id,
              uid: stored.uid || user.uid,
              username: stored.username || user.username,
              email: stored.email || user.email,
              emailVerified: stored.emailVerified ?? true,
              displayName: stored.displayName || stored.username || user.displayName,
              createdAt: stored.createdAt || user.createdAt,
              hasPassword: true,
              twoFactor: false
            };
          }
          const connRaw = await context.env.LORNAI_KV.get(`connections:${user.username.toLowerCase()}`);
          if (connRaw) {
            connections = JSON.parse(connRaw);
          }
        } catch {}
      }

      return new Response(JSON.stringify({
        app: "lorn",
        user,
        connections,
        adminPanel: false,
        staffRole: null,
        mfaPending: false,
        csrf: "lorn_cf_csrf_token"
      }), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    }
  }

  return new Response(JSON.stringify({
    app: "lorn",
    user: null,
    csrf: "lorn_cf_csrf_token"
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
