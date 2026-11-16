export async function onRequestPut(context) {
  const id = context.params.id;
  try {
    const buffer = await context.request.arrayBuffer();
    if (context.env?.LORNAI_KV && id && buffer) {
      await context.env.LORNAI_KV.put(`raw_asset:${id}`, buffer);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message || "Failed to receive binary" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
