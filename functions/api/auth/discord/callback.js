function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    list[name] = decodeURIComponent(rest.join('=').trim());
  });
  return list;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return Response.redirect(`${url.origin}/login?error=oauth_denied`, 302);
  }

  const cookies = parseCookies(context.request.headers.get("Cookie"));
  const oauthCookie = cookies.lorn_oauth || "";
  const [savedState, intent, savedNext] = oauthCookie.split(":");

  if (!savedState || savedState !== state) {
    return Response.redirect(`${url.origin}/login?error=oauth_state_mismatch`, 302);
  }

  const clientId = context.env?.DISCORD_CLIENT_ID;
  const clientSecret = context.env?.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.redirect(`${url.origin}/login?error=discord_not_configured`, 302);
  }

  try {
    const redirectUri = `${url.origin}/api/auth/discord/callback`;
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenRes.ok) {
      return Response.redirect(`${url.origin}/login?error=oauth_exchange_failed`, 302);
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userRes.ok) {
      return Response.redirect(`${url.origin}/login?error=oauth_exchange_failed`, 302);
    }

    const dUser = await userRes.json();
    const discordId = dUser.id;
    const discordUsername = dUser.username;

    let user = null;

    if (context.env?.LORNAI_KV) {
      const existing = await context.env.LORNAI_KV.get(`discord:${discordId}`);
      if (existing) {
        user = JSON.parse(existing);
      }
    }

    if (!user) {
      user = {
        id: "usr_" + Math.random().toString(36).slice(2, 10),
        uid: Math.floor(Math.random() * 89999 + 10000),
        username: discordUsername.slice(0, 12).replace(/[^a-zA-Z0-9_.]/g, "") || "user",
        email: dUser.email || `${discordUsername}@discord.lorn.lol`,
        emailVerified: true,
        displayName: dUser.global_name || discordUsername,
        createdAt: new Date().toISOString(),
        hasPassword: false,
        twoFactor: false
      };

      if (context.env?.LORNAI_KV) {
        await context.env.LORNAI_KV.put(`discord:${discordId}`, JSON.stringify(user));
        await context.env.LORNAI_KV.put(`user:${user.username.toLowerCase()}`, JSON.stringify(user));
      }
    }

    const token = btoa(unescape(encodeURIComponent(JSON.stringify(user)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const cookieHeader = `lorn_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
    const nextUrl = decodeURIComponent(savedNext || "/dashboard");

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${url.origin}${nextUrl.startsWith("/") ? nextUrl : "/dashboard"}`,
        "Set-Cookie": cookieHeader
      }
    });
  } catch (err) {
    return Response.redirect(`${url.origin}/login?error=oauth_invalid`, 302);
  }
}
