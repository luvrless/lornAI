export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": "lorn_session=; Path=/; HttpOnly; Max-Age=0"
    }
  });
}
