// Cloudflare Worker entry: serves the built SPA from ./dist and the /api/* routes.
// Secrets: `wrangler secret put FLAIR_API_KEY` (and optionally GEMINI_API_KEY, DEEPSEEK_API_KEY).
import { handleApi } from "./api/handler.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);

    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    // SPA fallback
    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  },
};
