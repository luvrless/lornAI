/**
 * Cloudflare Pages Function: POST /api/v1/images/generate
 * Programmatic Image Generation API (OpenAI-compatible)
 */

export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { prompt = "A serene cybernetic landscape at twilight", size = "1024x1024", n = 1 } = body;
  const [width, height] = size.split("x").map(Number);

  const images = [];
  for (let i = 0; i < Math.min(n, 4); i++) {
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width || 1024}&height=${height || 1024}&seed=${seed}&nologo=true&enhance=true&model=flux`;
    images.push({ url: imageUrl });
  }

  return new Response(JSON.stringify({
    created: Math.floor(Date.now() / 1000),
    data: images
  }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
