export async function onRequest(context) {
  return new Response(JSON.stringify({
    app: "lorn",
    email_security: true,
    email_product: false,
    inapp_all: true
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
