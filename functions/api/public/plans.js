export async function onRequestGet() {
  return new Response(JSON.stringify({
    premium: {
      name: "Premium",
      priceCents: 499,
      currency: "usd",
      billing: "monthly"
    }
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
