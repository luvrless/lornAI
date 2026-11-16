export async function onRequestGet(context) {
  let members = 142;
  let views = 2840;
  let live = 98;

  if (context.env?.LORNAI_KV) {
    try {
      const kvMembers = await context.env.LORNAI_KV.get("stats:members");
      if (kvMembers) members = Number(kvMembers) || members;

      const kvViews = await context.env.LORNAI_KV.get("stats:views");
      if (kvViews) views = Number(kvViews) || views;

      const kvLive = await context.env.LORNAI_KV.get("stats:live");
      if (kvLive) live = Number(kvLive) || live;
    } catch {}
  }

  return new Response(JSON.stringify({ members, views, live }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
