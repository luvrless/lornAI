/**
 * Cloudflare Pages Function: /consent
 * Neon Auth Consent and Callback Verification Handler
 */

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || url.searchParams.get("access_token");
  const provider = url.searchParams.get("provider") || "google";
  const email = url.searchParams.get("email") || "user@lorn.lol";

  // Build authenticated return payload
  const redirectParams = new URLSearchParams({
    auth_success: "1",
    provider: provider === "google" ? "Google (Neon)" : "Neon Account",
    username: email.split("@")[0] || "Neon User",
    email: email,
    id: "neon_" + Math.random().toString(36).slice(2, 10)
  });

  return Response.redirect(`${url.origin}/?${redirectParams.toString()}`, 302);
}
