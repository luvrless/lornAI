/**
 * Cloudflare Pages Function: Route /docs to docs/index.html
 */

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  return context.env.ASSETS.fetch(new URL('/docs/index.html', url.origin));
}
