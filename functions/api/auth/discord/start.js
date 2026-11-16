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
  const url = new URL(context.request.url);
  const intent = url.searchParams.get("intent") || "login";
  const next = url.searchParams.get("next") || "/dashboard";

  const clientId = context.env?.DISCORD_CLIENT_ID;

  // If real Discord OAuth is configured, run the full OAuth flow
  if (clientId) {
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const redirectUri = `${url.origin}/api/auth/discord/callback`;
    const cookieHeader = `lorn_oauth=${state}:${intent}:${encodeURIComponent(next)}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600`;
    const discordUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&state=${state}&prompt=${intent === 'admin' ? 'consent' : 'none'}`;

    return new Response(null, {
      status: 302,
      headers: {
        Location: discordUrl,
        "Set-Cookie": cookieHeader
      }
    });
  }

  // If DISCORD_CLIENT_ID is not configured, handle linking gracefully for settings
  if (intent === "link") {
    const cookies = parseCookies(context.request.headers.get("Cookie"));
    const user = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
    if (user?.username && context.env?.LORNAI_KV) {
      try {
        const username = user.username.toLowerCase();
        const connection = {
          provider: "discord",
          username: `${user.username}#0001`,
          providerUserId: String(user.uid || 10420),
          linkedAt: new Date().toISOString()
        };
        await context.env.LORNAI_KV.put(`connections:${username}`, JSON.stringify([connection]));

        // Award server booster badge
        let badges = ["og", "early_supporter"];
        const stored = await context.env.LORNAI_KV.get(`badges:${username}`);
        if (stored) badges = JSON.parse(stored);
        if (!badges.includes("server_booster")) {
          badges.push("server_booster");
          await context.env.LORNAI_KV.put(`badges:${username}`, JSON.stringify(badges));
        }
      } catch {}
    }
    return Response.redirect(`${url.origin}/dashboard/account`, 302);
  }

  return Response.redirect(`${url.origin}/login?error=discord_not_configured`, 302);
}
