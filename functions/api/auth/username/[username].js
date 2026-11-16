export async function onRequestGet(context) {
  const username = (context.params.username || "").toLowerCase().trim();

  if (!username || !/^[a-z0-9_.]{1,12}$/.test(username)) {
    return new Response(JSON.stringify({ available: false, reason: "1-12 characters, letters, numbers, dot or underscore" }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  const reserved = ["admin", "api", "dashboard", "login", "register", "signup", "terms", "privacy", "static", "brand", "help", "support", "explore", "settings", "null", "undefined"];
  if (reserved.includes(username)) {
    return new Response(JSON.stringify({ available: false, reason: "That username is reserved" }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  if (context.env?.LORNAI_KV) {
    try {
      const existing = await context.env.LORNAI_KV.get(`user:${username}`);
      if (existing) {
        return new Response(JSON.stringify({ available: false, reason: "This username is taken" }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
        });
      }
    } catch {}
  }

  return new Response(JSON.stringify({ available: true, username }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
