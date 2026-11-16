export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    app: "lorn",
    badges: [],
    credits: 0,
    customRequests: []
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function onRequestPut(context) {
  return new Response(JSON.stringify({ app: "lorn", ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
