export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 1. Fetch directly from assets (static chunks, css, images, etc.)
    let response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

    // 2. Clean URL resolution (/ -> /index.html, /login -> /login.html, /tree -> /tree.html)
    let pathname = url.pathname;
    if (pathname === "/" || pathname === "") {
      pathname = "/index";
    }
    
    if (!pathname.includes('.')) {
      const cleanPath = pathname.replace(/\/$/, "") + ".html";
      const htmlReq = new Request(new URL(cleanPath, request.url), request);
      const htmlRes = await env.ASSETS.fetch(htmlReq);
      if (htmlRes.status !== 404) {
        return htmlRes;
      }
    }

    // 3. Fallback: try /index.html then /login.html
    const indexRes = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    if (indexRes.status !== 404) {
      return indexRes;
    }

    const loginRes = await env.ASSETS.fetch(new Request(new URL("/login.html", request.url), request));
    if (loginRes.status !== 404) {
      return loginRes;
    }

    return response;
  }
};
