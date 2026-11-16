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
  function json(data, status = 200) {
    return new Response(JSON.stringify({ app: "lorn", ...data }), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  if (!user?.username) {
    return json({ error: { code: "unauthorized", message: "Sign in required" } }, 401);
  }

  try {
    const body = await context.request.json().catch(() => ({}));
    const nextPassword = body.next || "";
    if (!nextPassword || nextPassword.length < 8) {
      return json({ error: { code: "invalid_password", message: "Password must be at least 8 characters" } }, 400);
    }

    if (context.env?.LORNAI_KV) {
      const lower = user.username.toLowerCase();
      const existingData = await context.env.LORNAI_KV.get(`user:${lower}`);
      if (existingData) {
        const userObj = JSON.parse(existingData);
        userObj.password = nextPassword;
        userObj.hasPassword = true;
        await context.env.LORNAI_KV.put(`user:${lower}`, JSON.stringify(userObj));
      }
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: { message: err.message || "Failed to update password" } }, 500);
  }
}
