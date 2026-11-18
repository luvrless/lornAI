// Client-side model catalog. Flair 5.5 (powered by Lorn) is the main model, served via the abliteration.ai API.
export const MODELS = [
  { id: "flair-5.5", provider: "flair", name: "Flair 5.5", desc: "Lorn · main model · 262K context · reasoning", badge: "Default", maxOut: 262144 },
  { id: "flair-5.5-large", provider: "flair", name: "Flair 5.5 Large", desc: "Lorn · deeper knowledge · 1M context", maxOut: 262144 },
  { id: "flair-5.5-flash", provider: "flair", name: "Flair 5.5 Flash", desc: "Lorn · fast · 1M context", maxOut: 262144 },
  { id: "gemini-3.5-flash", provider: "gemini", name: "Gemini 3.5 Flash", desc: "Second model · Google", maxOut: 65536 },
  { id: "gemini-3.1-pro", provider: "gemini", name: "Gemini 3.1 Pro", desc: "Google · strongest reasoning", maxOut: 65536 },
  { id: "gemini-3.5-flash-lite", provider: "gemini", name: "Gemini 3.5 Flash-Lite", desc: "Google · lightweight", maxOut: 65536 },
  { id: "deepseek-v4-flash", provider: "deepseek", name: "DeepSeek V4 Flash", desc: "api.deepseek.com · needs key", maxOut: 65536 },
  { id: "deepseek-v4-pro", provider: "deepseek", name: "DeepSeek V4 Pro", desc: "api.deepseek.com · needs key", maxOut: 65536 },
];

export const PROVIDER_LABEL = { flair: "Flair · Lorn", gemini: "Gemini · Google", deepseek: "DeepSeek" };

export const getModel = (id) => MODELS.find((m) => m.id === id) || MODELS[0];

export const REASONING_LEVELS = [
  { id: "low", label: "Low", desc: "Quick answers, light thinking" },
  { id: "high", label: "High", desc: "Careful step-by-step reasoning" },
  { id: "max", label: "Max", desc: "Maximum depth for hard problems" },
];
