// FlairGPT API handler — runtime-agnostic (Cloudflare Workers + Node 20+).
// Exposes:
//   GET  /api/config  -> which providers have a server-side key configured
//   POST /api/chat    -> normalized SSE stream: {type:"reasoning"|"content"|"usage"|"error"|"done", ...}
//
// API keys are read from environment variables / Worker secrets — never shipped to the browser:
//   FLAIR_API_KEY (or ABLIT_KEY)  -> https://api.abliteration.ai/v1   (main model: Flair 5.5)
//   GEMINI_API_KEY                -> https://generativelanguage.googleapis.com
//   DEEPSEEK_API_KEY              -> https://api.deepseek.com
// A user may also supply their own key in Settings; it is sent per request and never stored server-side.

export const PROVIDERS = {
  flair: {
    label: "Flair",
    baseURL: "https://api.abliteration.ai/v1",
    envKeys: ["FLAIR_API_KEY", "ABLIT_KEY"],
    type: "openai",
    models: {
      "flair-5.5": "abliterated-model",
      "flair-5.5-large": "abliterated-model-large-v2",
      "flair-5.5-flash": "abliterated-model-large-flash",
    },
  },
  deepseek: {
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    envKeys: ["DEEPSEEK_API_KEY"],
    type: "openai",
    models: {
      "deepseek-v4-flash": "deepseek-v4-flash",
      "deepseek-v4-pro": "deepseek-v4-pro",
    },
  },
  gemini: {
    label: "Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    type: "gemini",
    models: {
      "gemini-3.5-flash": "gemini-3.5-flash",
      "gemini-3.1-pro": "gemini-3.1-pro-preview",
      "gemini-3.5-flash-lite": "gemini-3.5-flash-lite",
    },
  },
};

const REASONING = ["low", "high", "max"];

function envKey(env, provider) {
  for (const k of PROVIDERS[provider].envKeys) if (env?.[k]) return String(env[k]).trim();
  return "";
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function handleApi(request, env = {}) {
  const url = new URL(request.url);

  if (url.pathname === "/api/config" && request.method === "GET") {
    const providers = {};
    for (const [id, p] of Object.entries(PROVIDERS)) {
      providers[id] = { label: p.label, configured: Boolean(envKey(env, id)), models: Object.keys(p.models) };
    }
    return json({ name: "FlairGPT", defaultModel: "flair-5.5", providers });
  }

  if (url.pathname === "/api/chat" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    return chat(body, env, request.signal);
  }

  return json({ error: "Not found" }, 404);
}

function chat(body, env, signal) {
  const provider = PROVIDERS[body.provider] ? body.provider : "flair";
  const cfg = PROVIDERS[provider];
  const model = cfg.models[body.model] || body.model || Object.values(cfg.models)[0];
  const apiKey = (body.apiKey && String(body.apiKey).trim()) || envKey(env, provider);
  const reasoning = REASONING.includes(body.reasoning) ? body.reasoning : "high";
  const maxTokens = clampInt(body.maxTokens, 256, 262144, 8192);
  const temperature = typeof body.temperature === "number" ? Math.min(2, Math.max(0, body.temperature)) : undefined;
  const system = typeof body.system === "string" ? body.system : "";
  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content }))
    : [];

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {}
      };
      try {
        if (!apiKey) {
          throw new Error(
            `No API key configured for ${cfg.label}. Set ${cfg.envKeys[0]} on the server, or add your own key in Settings → API Keys.`
          );
        }
        if (!messages.length) throw new Error("No messages to send.");
        const args = { cfg, model, apiKey, system, messages, reasoning, maxTokens, temperature, send, signal };
        if (cfg.type === "gemini") await geminiChat(args);
        else await openaiChat(args);
        send({ type: "done" });
      } catch (err) {
        if (err?.name !== "AbortError") send({ type: "error", message: err?.message || String(err) });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

function clampInt(v, min, max, dflt) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

// ---------- OpenAI-compatible providers (Flair / abliteration.ai, DeepSeek) ----------
async function openaiChat({ cfg, model, apiKey, system, messages, reasoning, maxTokens, temperature, send, signal }) {
  const msgs = system ? [{ role: "system", content: system }, ...messages] : messages;
  const base = { model, messages: msgs, stream: true, max_tokens: maxTokens, stream_options: { include_usage: true } };
  if (temperature !== undefined) base.temperature = temperature;

  let extras;
  if (cfg === PROVIDERS.flair) {
    // abliteration.ai: reasoning budget is controlled via `reasoning.max_tokens` (counts toward max_tokens).
    const budget = { low: 1024, high: 8192, max: 65536 }[reasoning];
    extras = { reasoning: { effort: reasoning === "low" ? "low" : "high", max_tokens: Math.min(budget, Math.floor(maxTokens * 0.75)) } };
  } else {
    extras = { reasoning_effort: reasoning === "max" ? "max" : "high", thinking: { type: "enabled" } };
    if (reasoning === "low") extras.reasoning_effort = "low";
  }

  let res = await post(`${cfg.baseURL}/chat/completions`, apiKey, { ...base, ...extras }, signal);
  // Some models reject unknown params — retry once without the reasoning extras.
  if (res.status === 400 || res.status === 422) {
    const text = await res.text();
    if (/reasoning|thinking|stream_options|unknown|unrecognized|extra/i.test(text)) {
      const { stream_options, ...plain } = base;
      res = await post(`${cfg.baseURL}/chat/completions`, apiKey, plain, signal);
    } else {
      throw new Error(apiError(cfg.label, 400, text));
    }
  }
  if (!res.ok) throw new Error(apiError(cfg.label, res.status, await res.text()));

  await readSSE(res.body, (data) => {
    if (data === "[DONE]") return;
    let chunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      return;
    }
    if (chunk.error) throw new Error(chunk.error.message || JSON.stringify(chunk.error));
    const delta = chunk.choices?.[0]?.delta || {};
    const r = delta.reasoning ?? delta.reasoning_content;
    if (r) send({ type: "reasoning", text: r });
    if (delta.content) send({ type: "content", text: delta.content });
    const fin = chunk.choices?.[0]?.finish_reason;
    if (fin) send({ type: "finish", reason: fin });
    if (chunk.usage) send({ type: "usage", usage: chunk.usage });
  });
}

// Retry transient provider failures (rate limits / overload) with exponential backoff.
async function withRetry(doFetch, signal, tries = 3) {
  for (let i = 0; ; i++) {
    const res = await doFetch();
    if (i >= tries - 1 || ![429, 500, 502, 503, 504, 529].includes(res.status)) return res;
    try {
      await res.body?.cancel();
    } catch {}
    await new Promise((r, j) => {
      const t = setTimeout(r, 1200 * 2 ** i);
      signal?.addEventListener("abort", () => (clearTimeout(t), j(new DOMException("Aborted", "AbortError"))), { once: true });
    });
  }
}

function post(url, apiKey, payload, signal) {
  return withRetry(() => postOnce(url, apiKey, payload, signal), signal);
}

function postOnce(url, apiKey, payload, signal) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, accept: "text/event-stream" },
    body: JSON.stringify(payload),
    signal,
  });
}

function apiError(label, status, text) {
  let msg = text;
  try {
    const j = JSON.parse(text);
    msg = j.error?.message || j.message || j.detail || text;
    if (Array.isArray(j) && j[0]?.error) msg = j[0].error.message;
  } catch {}
  return `${label} API error ${status}: ${String(msg).slice(0, 600)}`;
}

async function readSSE(body, onData) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx).replace(/^\r?\n\r?\n/, "");
      const data = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).replace(/^ /, ""))
        .join("\n");
      if (data) onData(data);
    }
  }
  if (buf.trim().startsWith("data:")) onData(buf.trim().slice(5).trim());
}

// ---------- Gemini (native generateContent) ----------
async function geminiChat({ cfg, model, apiKey, system, messages, reasoning, maxTokens, temperature, send, signal }) {
  const payload = {
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: {
      maxOutputTokens: Math.min(maxTokens, 65536),
      thinkingConfig: { includeThoughts: true, thinkingLevel: reasoning === "low" ? "low" : "high" },
    },
  };
  if (temperature !== undefined) payload.generationConfig.temperature = temperature;
  if (system) payload.systemInstruction = { parts: [{ text: system }] };

  const call = (p) =>
    withRetry(() => fetch(`${cfg.baseURL}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(p),
      signal,
    }), signal);

  let res = await call(payload);
  if (res.status === 400) {
    const text = await res.text();
    if (/thinking/i.test(text)) {
      delete payload.generationConfig.thinkingConfig;
      res = await call(payload);
    } else throw new Error(apiError(cfg.label, 400, text));
  }
  if (!res.ok) throw new Error(apiError(cfg.label, res.status, await res.text()));
  const data = await res.json();
  const cand = data.candidates?.[0];
  if (!cand) throw new Error(`Gemini returned no candidates${data.promptFeedback ? ": " + JSON.stringify(data.promptFeedback) : ""}`);
  for (const part of cand.content?.parts || []) {
    if (!part.text) continue;
    send({ type: part.thought ? "reasoning" : "content", text: part.text });
  }
  if (cand.finishReason) send({ type: "finish", reason: cand.finishReason === "MAX_TOKENS" ? "length" : cand.finishReason.toLowerCase() });
  if (data.usageMetadata) {
    send({
      type: "usage",
      usage: {
        prompt_tokens: data.usageMetadata.promptTokenCount,
        completion_tokens: (data.usageMetadata.candidatesTokenCount || 0) + (data.usageMetadata.thoughtsTokenCount || 0),
        total_tokens: data.usageMetadata.totalTokenCount,
      },
    });
  }
}
