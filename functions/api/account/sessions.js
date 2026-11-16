export async function onRequestGet(context) {
  return new Response(JSON.stringify([]), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function onRequestPost(context) {
  return new Response(JSON.stringify({ app: "lorn", ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function onRequestDelete(context) {
  return new Response(JSON.stringify({ app: "lorn", ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
