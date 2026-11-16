export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const intent = url.searchParams.get("intent") || "login";
  const next = url.searchParams.get("next") || "/dashboard";

  const clientId = context.env?.DISCORD_CLIENT_ID;
  if (!clientId) {
    return Response.redirect(`${url.origin}/login?error=discord_not_configured`, 302);
  }

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
