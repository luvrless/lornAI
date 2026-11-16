function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    try { list[name] = decodeURIComponent(rest.join('=').trim()); } catch { list[name] = rest.join('=').trim(); }
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
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return Response.redirect(`${url.origin}/dashboard/account?error=oauth_denied`, 302);
  }

  const cookies = parseCookies(context.request.headers.get("Cookie"));
  const oauthCookie = cookies.lorn_oauth || "";
  const [savedState, intent, savedNext] = oauthCookie.split(":");

  const clientId = context.env?.DISCORD_CLIENT_ID || "1519745897905393965";
  const clientSecret = context.env?.DISCORD_CLIENT_SECRET || "wJMdX1_XDr15mpAcdUh092lUc02zoAYo";
  const redirectUri = `${url.origin}/api/auth/callback/discord`;

  try {
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
      return Response.redirect(`${url.origin}/dashboard/account?error=oauth_exchange_failed`, 302);
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userRes.ok) {
      return Response.redirect(`${url.origin}/dashboard/account?error=oauth_user_failed`, 302);
    }

    const dUser = await userRes.json();
    const discordId = dUser.id;
    const discordUsername = dUser.discriminator && dUser.discriminator !== "0"
      ? `${dUser.username}#${dUser.discriminator}`
      : dUser.username;
    const discordAvatar = dUser.avatar
      ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png`
      : "";

    // 1. Check if linking to existing account
    let sessionUser = cookies.lorn_session ? decodeToken(cookies.lorn_session) : null;
    if (intent === "link" || sessionUser?.username) {
      if (sessionUser?.username && context.env?.LORNAI_KV) {
        const username = sessionUser.username.toLowerCase();
        const connection = {
          provider: "discord",
          username: discordUsername,
          providerUserId: discordId,
          avatar: discordAvatar,
          linkedAt: new Date().toISOString()
        };
        await context.env.LORNAI_KV.put(`connections:${username}`, JSON.stringify([connection]));
        await context.env.LORNAI_KV.put(`discord:${discordId}`, username);

        // Award server booster badge
        let badges = ["og", "early_supporter"];
        try {
          const stored = await context.env.LORNAI_KV.get(`badges:${username}`);
          if (stored) badges = JSON.parse(stored);
        } catch {}
        if (!badges.includes("server_booster")) {
          badges.push("server_booster");
          await context.env.LORNAI_KV.put(`badges:${username}`, JSON.stringify(badges));
        }
      }
      return Response.redirect(`${url.origin}/dashboard/account?success=discord_connected`, 302);
    }

    // 2. Sign in or register via Discord
    let user = null;
    if (context.env?.LORNAI_KV) {
      try {
        const mappedUsername = await context.env.LORNAI_KV.get(`discord:${discordId}`);
        if (mappedUsername) {
          const userRaw = await context.env.LORNAI_KV.get(`user:${mappedUsername.toLowerCase()}`);
          if (userRaw) user = JSON.parse(userRaw);
        }
      } catch {}
    }

    if (!user) {
      // Allocate sequential UID
      let uid = 1;
      if (context.env?.LORNAI_KV) {
        try {
          const lastUid = await context.env.LORNAI_KV.get("next_uid");
          if (lastUid) {
            uid = Number(lastUid) || 1;
          } else {
            const members = Number(await context.env.LORNAI_KV.get("stats:members")) || 0;
            uid = members > 0 ? members + 1 : 1;
          }
          await context.env.LORNAI_KV.put("next_uid", String(uid + 1));
        } catch {}
      }

      const cleanUsername = (dUser.username || "user").slice(0, 12).replace(/[^a-zA-Z0-9_.]/g, "") || "user";
      user = {
        id: "usr_" + Math.random().toString(36).slice(2, 10),
        uid,
        username: cleanUsername,
        email: dUser.email || `${cleanUsername}@discord.lorn.lol`,
        emailVerified: true,
        displayName: dUser.global_name || dUser.username,
        createdAt: new Date().toISOString(),
        hasPassword: false,
        twoFactor: false
      };

      if (context.env?.LORNAI_KV) {
        try {
          await context.env.LORNAI_KV.put(`discord:${discordId}`, cleanUsername.toLowerCase());
          await context.env.LORNAI_KV.put(`user:${cleanUsername.toLowerCase()}`, JSON.stringify(user));
          const connection = {
            provider: "discord",
            username: discordUsername,
            providerUserId: discordId,
            avatar: discordAvatar,
            linkedAt: new Date().toISOString()
          };
          await context.env.LORNAI_KV.put(`connections:${cleanUsername.toLowerCase()}`, JSON.stringify([connection]));
        } catch {}
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
    return Response.redirect(`${url.origin}/dashboard/account?error=oauth_error`, 302);
  }
}
