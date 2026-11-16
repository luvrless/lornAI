export async function onRequestGet(context) {
  const id = context.params.id;
  if (!context.env?.LORNAI_KV || !id) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const assetRaw = await context.env.LORNAI_KV.get(`asset:${id}`);
    let mime = "application/octet-stream";
    if (assetRaw) {
      const asset = JSON.parse(assetRaw);
      mime = asset.mime || mime;
    }

    const data = await context.env.LORNAI_KV.get(`raw_asset:${id}`, "arrayBuffer");
    if (!data) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(data, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
}
