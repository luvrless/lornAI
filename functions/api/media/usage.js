export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    app: "lorn",
    usedBytes: 0,
    quotaBytes: 104857600,
    byKind: []
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
