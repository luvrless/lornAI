// Node server for local dev / Docker / any VPS.
//   node --env-file=.env server.js            -> serves ./dist + /api on PORT (default 8787)
//   node --env-file=.env server.js --api-only -> API only (Vite dev server proxies /api here)
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { handleApi } from "./api/handler.js";

const PORT = Number(process.env.PORT) || 8787;
const API_ONLY = process.argv.includes("--api-only");
const DIST = join(fileURLToPath(new URL(".", import.meta.url)), "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

async function serveStatic(req, res) {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) return void res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(DIST, "index.html");
  }
  try {
    const data = await readFile(file);
    const cache = file.includes(`${join(DIST, "assets")}`) ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": cache });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found — run `npm run build` first.");
  }
}

http
  .createServer(async (req, res) => {
    if (!req.url.startsWith("/api/")) {
      if (API_ONLY) return void res.writeHead(404).end();
      return serveStatic(req, res);
    }
    const ac = new AbortController();
    res.on("close", () => !res.writableEnded && ac.abort());
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req);
    const request = new Request(new URL(req.url, `http://${req.headers.host || "localhost"}`), {
      method: req.method,
      headers: req.headers,
      body,
      duplex: "half",
      signal: ac.signal,
    });
    try {
      const response = await handleApi(request, process.env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        for await (const chunk of response.body) res.write(chunk);
      }
      res.end();
    } catch (err) {
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err?.message || err) }));
    }
  })
  .listen(PORT, () => {
    console.log(`FlairGPT ${API_ONLY ? "API" : "server"} listening on http://localhost:${PORT}`);
  });
