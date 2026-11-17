export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // First attempt: fetch directly from assets
    let response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

    // Second attempt: clean URLs (e.g. /tree -> /tree.html)
    if (!url.pathname.includes('.')) {
      const pathWithHtml = url.pathname.replace(/\/$/, "") + ".html";
      const htmlReq = new Request(new URL(pathWithHtml, request.url), request);
      const htmlRes = await env.ASSETS.fetch(htmlReq);
      if (htmlRes.status !== 404) {
        return htmlRes;
      }
    }

    // Fallback to index.html for client-side routing
    const fallbackReq = new Request(new URL("/index.html", request.url), request);
    return env.ASSETS.fetch(fallbackReq);
  }
};
