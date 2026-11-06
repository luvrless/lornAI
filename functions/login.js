/**
 * Cloudflare Pages Function: /login
 * Production Login Router for lornAI, supporting Neon Google Auth, Discord OAuth & Session Redirects
 */

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  // 1. Google Auth via Neon
  if (provider === "google") {
    const neonAuthUrl = "https://ep-blue-mouse-b92xm8gi.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth";
    const redirectUri = encodeURIComponent("https://lorn.lol/consent?provider=google");
    return Response.redirect(`${neonAuthUrl}?redirect_uri=${redirectUri}&response_type=token&scope=openid+email+profile`, 302);
  }

  // 2. Discord OAuth
  if (provider === "discord") {
    const CLIENT_ID = "1460381998051889225";
    const REDIRECT_URI = encodeURIComponent("https://lorn.lol/api/auth/callback/discord");
    return Response.redirect(`https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=identify+email`, 302);
  }

  // 3. Fallback: Redirect to main app with login modal open
  return Response.redirect(`${url.origin}/?open_auth=1`, 302);
}
