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
  const username = user?.username ? user.username.toLowerCase() : "";

  if (context.env?.LORNAI_KV && username) {
    try {
      let userOwned = ["og", "early_supporter"];
      const stored = await context.env.LORNAI_KV.get(`badges:${username}`);
      if (stored) userOwned = JSON.parse(stored);
      if (!userOwned.includes("server_booster")) {
        userOwned.push("server_booster");
        await context.env.LORNAI_KV.put(`badges:${username}`, JSON.stringify(userOwned));
      }
    } catch {}
  }

  return new Response(JSON.stringify({ app: "lorn", ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
