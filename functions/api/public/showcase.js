export async function onRequestGet(context) {
  let profiles = [
    { username: "alice", name: "Alice", bio: "digital artist & designer", views: 1420, colors: ["#38bdf8", "#6366f1"] },
    { username: "neon", name: "neon", bio: "music producer & sound design", views: 2890, colors: ["#ec4899", "#8b5cf6"] },
    { username: "luna", name: "Luna", bio: "software engineer", views: 980, colors: ["#10b981", "#3b82f6"] }
  ];

  if (context.env?.LORNAI_KV) {
    try {
      const raw = await context.env.LORNAI_KV.get("public:showcase");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          profiles = parsed;
        }
      }
    } catch {}
  }

  return new Response(JSON.stringify({ profiles }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
