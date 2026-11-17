export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Try direct asset lookup first (handles /_next/static/*, /robots.txt, etc.)
    const directRes = await env.ASSETS.fetch(request);
    if (directRes.status !== 404) {
      return directRes;
    }

    // 2. Never fall back to HTML for /_next/ paths — those are real static assets.
    //    If not found as an asset, return 404 immediately.
    if (pathname.startsWith("/_next/")) {
      return new Response("Not found", { status: 404 });
    }

    // 3. For extensionless routes, try route.html then route/index.html
    if (!pathname.includes(".")) {
      const clean = pathname.replace(/\/$/, "") || "/index";

      // Try /path.html
      const htmlRes = await env.ASSETS.fetch(
        new Request(new URL(clean + ".html", url), request)
      );
      if (htmlRes.status !== 404) return htmlRes;

      // Try /path/index.html
      const indexRes = await env.ASSETS.fetch(
        new Request(new URL(clean + "/index.html", url), request)
      );
      if (indexRes.status !== 404) return indexRes;
    }

    // 4. Final fallback: serve index.html (SPA-style)
    const root = await env.ASSETS.fetch(
      new Request(new URL("/index.html", url), request)
    );
    if (root.status !== 404) return root;

    return new Response("Not found", { status: 404 });
  },
};
