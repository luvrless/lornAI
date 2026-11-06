/**
 * Cloudflare Pages Function: Discord OAuth Callback Handler
 * Endpoint: https://lorn.lol/api/auth/callback/discord
 */

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return Response.redirect(`${url.origin}/?auth_error=${encodeURIComponent(error || "missing_code")}`, 302);
  }

  const CLIENT_ID = "1460381998051889225";
  const CLIENT_SECRET = context.env?.DISCORD_CLIENT_SECRET || "1wGsxlhJdLOak5kyOF3zIjVFqMoB89A6";
  const REDIRECT_URI = "https://lorn.lol/api/auth/callback/discord";

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return Response.redirect(`${url.origin}/?auth_error=${encodeURIComponent(errText)}`, 302);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch Discord User profile
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      return Response.redirect(`${url.origin}/?auth_error=failed_user_fetch`, 302);
    }

    const userData = await userResponse.json();

    // 3. Construct user avatar URL
    let avatarUrl = "";
    if (userData.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;
    }

    // 4. Redirect back to lorn.lol app with auth payload
    const redirectParams = new URLSearchParams({
      auth_success: "1",
      provider: "discord",
      username: userData.global_name || userData.username || "Discord User",
      email: userData.email || "",
      avatar: avatarUrl,
      id: userData.id
    });

    return Response.redirect(`${url.origin}/?${redirectParams.toString()}`, 302);

  } catch (err) {
    return Response.redirect(`${url.origin}/?auth_error=${encodeURIComponent(err.message)}`, 302);
  }
}
