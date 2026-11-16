export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    app: "lorn",
    email: false,
    discord: true,
    google: false,
    registration: true
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
