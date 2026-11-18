# FlairGPT

An AI coding agent with a DeepSeek-style interface, powered by **Flair 5.5**, a model by **Lorn** (served via the [abliteration.ai](https://abliteration.ai/) API).
It's set up to be a strong developer in every major language, with particular depth in **Lua/Luau and Roblox development**.

## Features

- **Models**
  - **Flair 5.5** is the main model, with Large and Flash variants (`api.abliteration.ai/v1`, OpenAI-compatible).
  - **Gemini** is the second model: 3.5 Flash, 3.1 Pro and 3.5 Flash-Lite.
  - **DeepSeek** V4 Flash and V4 Pro are optional (`api.deepseek.com`).
- **Settings tab**
  - Edit the system prompt.
  - Set reasoning to **Low / High / Max**.
  - Set **max output tokens**, from 256 up to the model's limit.
  - Adjust temperature, theme and typing speed.
  - Choose whether the code panel opens on its own and whether reasoning is shown.
  - Add API key overrides, export or delete data, and read the provider terms.
- **Live code panel that matches the language automatically**

  | Language | Preview runtime |
  | --- | --- |
  | HTML / SVG | Rendered page; CSS and JS blocks from the same answer are pulled in |
  | CSS | Demo page with the styles applied |
  | JavaScript / TypeScript | Sandboxed console |
  | JSX / TSX | React 18 app, with Tailwind available |
  | Python | Pyodide (CPython in WebAssembly) |
  | Lua | Lua 5.3 via Fengari |
  | Markdown, JSON, Mermaid | Document, interactive tree, diagram |
  | Luau / Roblox and 30+ other languages | Highlighted code with correct file names and downloads (no runtime) |

- **Animation**
  - Replies stream in with a typewriter effect and a blinking caret.
  - Code is typed live into the panel while it's being written.
  - The "Thinking…" header shimmers while the model reasons.
  - Messages, modals and panels slide and fade in.
  - The flame logo animates while a reply is generating.
- **Chat history** is grouped by date, with rename and delete. You can edit and resend a message, regenerate a reply, attach files, and switch between light and dark themes. The layout works on mobile.
- **Policies:** the Flair model runs under abliteration.ai's own terms and policies. FlairGPT adds no content filters of its own, and the system prompt is entirely yours to set.

## Configure API keys

Keys stay on the server. They are never committed to git and never sent to the browser.

| Variable | Provider |
| --- | --- |
| `FLAIR_API_KEY` (or `ABLIT_KEY`) | Flair 5.5 (abliteration.ai) |
| `GEMINI_API_KEY` | Google Gemini |
| `DEEPSEEK_API_KEY` | DeepSeek (optional) |

Each user can also paste their own key in **Settings → API Keys**. Those keys are kept only in that user's browser.

## Run locally

```bash
npm install
cp .env.example .env      # then fill in your keys
npm run build && npm start   # http://localhost:8787
```

Development mode with hot reload (the API runs on port 8787 and Vite on 5173):

```bash
npm run dev
```

## Deploy

**Cloudflare Workers.** `worker.js` serves `dist/` and the `/api` routes.

```bash
npx wrangler secret put FLAIR_API_KEY
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

**Docker or any Node host:**

```bash
docker compose up --build
```

## Structure

```
api/handler.js        provider proxy (Flair / Gemini / DeepSeek) -> normalized SSE stream
worker.js / server.js Cloudflare Worker and Node entry points
src/App.jsx           chat state, streaming, code-panel orchestration
src/components/       Sidebar, Composer, Message, Markdown, CodePanel, SettingsModal
src/lib/preview.js    language detection + live preview runtimes
src/lib/storage.js    settings, default system prompt, local chat storage
```
