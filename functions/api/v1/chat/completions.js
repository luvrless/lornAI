/**
 * Cloudflare Pages Function: POST /api/v1/chat/completions
 * lornAI public API — OpenAI-compatible, powered by Frail intelligence network.
 * Never exposes upstream providers.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const LORNAI_IDENTITY = `You are lornAI, an intelligent assistant developed by Frail as part of the lorn project (https://lorn.lol).
You are powered by a distributed proprietary intelligence network — not any single external AI brand.
Never claim to be OpenAI, GPT, NVIDIA, Claude, or any third-party AI.
If asked what model or AI you are, say you are lornAI by Frail.
Be helpful, conversational, and comprehensive.`;

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try { body = await request.json(); }
  catch {
    return new Response(JSON.stringify({ error: { message: 'Invalid JSON', type: 'invalid_request_error' } }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }

  const { model = 'lorn-5.5-sovereign', messages = [], stream = false, temperature = 0.72 } = body;
  const sysPrompt = `${LORNAI_IDENTITY}\n\nYou are operating as ${model}, a Frail intelligence tier within lornAI.`;
  const upstreamMsgs = [{ role: 'system', content: sysPrompt }, ...messages.filter(m => m.role !== 'system')];

  /* Try multiple upstream sources in order */
  const sources = [
    () => fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai', messages: upstreamMsgs, stream, temperature, seed: Math.floor(Math.random() * 99999) })
    }),
    () => fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: upstreamMsgs, stream, seed: Math.floor(Math.random() * 99999) })
    })
  ];

  for (const source of sources) {
    try {
      const res = await source();
      if (!res.ok) continue;

      if (stream) {
        return new Response(res.body, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS }
        });
      }

      const text = await res.text();
      let content = text;
      try {
        const j = JSON.parse(text);
        content = j.choices?.[0]?.message?.content || j.choices?.[0]?.delta?.content || text;
      } catch {}

      return new Response(JSON.stringify({
        id: 'chatcmpl-' + Math.random().toString(36).slice(2),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: upstreamMsgs.reduce((s, m) => s + (m.content || '').length / 4, 0) | 0, completion_tokens: content.length / 4 | 0, total_tokens: 0 }
      }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    } catch {}
  }

  /* Final fallback */
  return new Response(JSON.stringify({
    id: 'chatcmpl-' + Math.random().toString(36).slice(2),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: 'lornAI is momentarily unavailable. Please try again.' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  }), { status: 503, headers: { 'Content-Type': 'application/json', ...CORS } });
}
