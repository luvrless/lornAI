export async function onRequestGet(context) {
  return new Response(JSON.stringify([]), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
