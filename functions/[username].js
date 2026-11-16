const RESERVED = new Set([
  "api", "static", "brand", "dashboard", "admin", "login", "register",
  "signup", "forgot-password", "reset-password", "verify-email", "verify",
  "terms", "privacy", "favicon.ico", "robots.txt", "manifest.json", "sitemap.xml"
]);

export async function onRequestGet(context) {
  const username = (context.params.username || "").toLowerCase();

  if (!username || RESERVED.has(username) || username.includes(".")) {
    return context.next();
  }

  // Check if valid username pattern
  if (!/^[a-z0-9_.]{1,16}$/.test(username)) {
    return context.next();
  }

  // Check if user exists in KV
  let user = null;
  if (context.env?.LORNAI_KV) {
    try {
      const rawUser = await context.env.LORNAI_KV.get(`user:${username}`);
      if (rawUser) user = JSON.parse(rawUser);
    } catch {}
  }

  if (!user && (username === "alice" || username === "neon" || username === "luna" || username === "demo")) {
    user = { username, displayName: username.charAt(0).toUpperCase() + username.slice(1) };
  }

  // Fetch the static index.html from Pages assets
  if (context.env?.ASSETS) {
    try {
      const assetUrl = new URL("/", context.request.url);
      const res = await context.env.ASSETS.fetch(assetUrl);
      if (res.ok) {
        let html = await res.text();
        const displayName = user?.displayName || user?.username || username;
        
        if (user) {
          // Replace title and og metadata
          html = html.replace(/<title>.*?<\/title>/, `<title>${displayName} · LORN.LOL</title>`);
          html = html.replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${displayName} · LORN.LOL">`);
          return new Response(html, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=0, must-revalidate"
            }
          });
        } else {
          return new Response(html, {
            status: 404,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=0, must-revalidate"
            }
          });
        }
      }
    } catch {}
  }

  return context.next();
}
