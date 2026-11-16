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
  function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify({ app: "lorn", ...data }), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }
    });
  }

  const cookies = parseCookies(context.request.headers.get("Cookie"));
  let user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
  if (!user?.username) {
    return json({ error: { code: "unauthorized", message: "Sign in required" } }, 401);
  }

  try {
    const body = await context.request.json().catch(() => ({}));
    const newName = (body.username || "").trim();
    if (!newName || !/^[A-Za-z0-9_.]{1,12}$/.test(newName)) {
      return json({ error: { code: "invalid_username", message: "Username must be 1-12 characters, letters, numbers, dot or underscore" } }, 400);
    }

    const oldLower = user.username.toLowerCase();
    const newLower = newName.toLowerCase();

    if (oldLower !== newLower && context.env?.LORNAI_KV) {
      const taken = await context.env.LORNAI_KV.get(`user:${newLower}`);
      if (taken) {
        return json({ error: { code: "username_taken", message: "This username is taken" } }, 400);
      }

      const existingData = await context.env.LORNAI_KV.get(`user:${oldLower}`);
      let userObj = existingData ? JSON.parse(existingData) : { ...user };
      userObj.username = newName;
      userObj.displayName = newName;

      await context.env.LORNAI_KV.put(`user:${newLower}`, JSON.stringify(userObj));
      await context.env.LORNAI_KV.delete(`user:${oldLower}`);
      if (userObj.email) {
        await context.env.LORNAI_KV.put(`email:${userObj.email.toLowerCase()}`, newLower);
      }

      // Move draft & publish state if any
      const draft = await context.env.LORNAI_KV.get(`profile:${oldLower}`);
      if (draft) {
        await context.env.LORNAI_KV.put(`profile:${newLower}`, draft);
        await context.env.LORNAI_KV.delete(`profile:${oldLower}`);
      }
      const pub = await context.env.LORNAI_KV.get(`published:${oldLower}`);
      if (pub) {
        await context.env.LORNAI_KV.put(`published:${newLower}`, pub);
        await context.env.LORNAI_KV.delete(`published:${oldLower}`);
      }

      user = { ...user, username: newName, displayName: newName };
      const token = btoa(unescape(encodeURIComponent(JSON.stringify(user)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return json({ ok: true, user }, 200, {
        "Set-Cookie": `lorn_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
      });
    }

    return json({ ok: true, user });
  } catch (err) {
    return json({ error: { message: err.message || "Failed to update username" } }, 500);
  }
}
