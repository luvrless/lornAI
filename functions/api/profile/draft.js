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

export async function onRequestPut(context) {
  function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify({ app: "lorn", ...data }), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }
    });
  }

  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  if (!user?.username) user = { id: "usr_guest", username: "you" };

  try {
    const body = await context.request.json().catch(() => ({}));
    const config = body.config || body.draft || (body.identity ? body : null);
    const rev = (Number(body.rev) || 1) + 1;

    if (config && context.env?.LORNAI_KV && user.username) {
      try {
        await context.env.LORNAI_KV.put(`profile:${user.username.toLowerCase()}`, JSON.stringify(config));
      } catch {}
    }

    return json({
      ok: true,
      rev,
      premiumBlocked: [],
      savedAt: new Date().toISOString()
    });
  } catch (err) {
    return json({ error: { message: err.message || "Failed to save draft" } }, 500);
  }
}
