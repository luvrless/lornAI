/**
 * HTML pages. Public profiles are server-rendered with the same React
 * renderer the client hydrates, plus Open Graph / SEO metadata. Everything
 * else is the SPA shell.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import type { App } from "./app.ts";
import type { Ctx } from "./lib/http.ts";
import { getPublicProfile } from "./modules/profiles/service.ts";
import { publicMessage } from "./modules/profiles/routes.ts";
import { ProfileView } from "../web/profile/ProfileView.tsx";

const DIST = path.resolve(process.env.WEB_DIST ?? "dist/web");
let manifest: Record<string, string> | null = null;
function assets() {
  if (!manifest || process.env.NODE_ENV !== "production") {
    try { manifest = JSON.parse(fs.readFileSync(path.join(DIST, "manifest.json"), "utf8")); }
    catch { manifest = {}; }
  }
  return manifest!;
}

const RESERVED = new Set(["api", "static", "media", "dashboard", "admin", "login", "register", "signup", "forgot-password", "reset-password", "verify-email", "terms", "privacy", "favicon.ico", "robots.txt"]);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** JSON safe to embed inside <script type="application/json">. */
const embed = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

function csp(app: App, nonce: string) {
  const media = app.storage.name === "s3" ? new URL(app.storage.publicUrl("x")).origin : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com " + media,
    "img-src 'self' data: blob: https: " + media,
    "media-src 'self' blob: " + media,
    "connect-src 'self'",
    "frame-src https://www.youtube-nocookie.com https://open.spotify.com https://w.soundcloud.com https://embed.music.apple.com https://player.twitch.tv",
    "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'", "object-src 'none'",
  ].join("; ");
}

function shell(app: App, c: Ctx, o: { title: string; head?: string; body: string; script?: string; css: string[]; status?: number; nonce: string }) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#030716"><title>${esc(o.title)}</title>${o.head ?? ""}
${o.css.map((h) => `<link rel="stylesheet" href="/static/${h}">`).join("")}
</head><body>${o.body}${o.script ? `<script type="module" src="/static/${o.script}" nonce="${o.nonce}"></script>` : ""}</body></html>`;
  c.res.setHeader("Content-Security-Policy", csp(app, o.nonce));
  c.send(o.status ?? 200, html, "text/html; charset=utf-8", { "Cache-Control": "no-cache" });
}

export async function renderPage(app: App, c: Ctx): Promise<boolean> {
  if (c.method !== "GET") return false;
  const parts = c.url.pathname.split("/").filter(Boolean);
  const m = assets();
  const nonce = crypto.randomBytes(16).toString("base64");
  if (parts[0] === "robots.txt") { c.send(200, "User-agent: *\nDisallow: /api/\nDisallow: /dashboard\nDisallow: /admin\n", "text/plain"); return true; }

  const isProfile = parts.length >= 1 && parts.length <= 2 && !RESERVED.has(parts[0]) && /^[A-Za-z0-9_.]{1,12}$/.test(parts[0]);
  if (isProfile) {
    const res = await getPublicProfile(app, parts[0]);
    if (res.status !== "ok") {
      const msg = publicMessage(res.status);
      shell(app, c, { nonce, status: res.status === "not_found" ? 404 : 200, title: `${msg} · LORN.LOL`, head: `<meta name="robots" content="noindex">`, css: [m["app.css"]].filter(Boolean),
        body: `<div class="lp-missing"><div><h1>${esc(msg)}</h1><p>${res.status === "not_found" ? `lorn.lol/${esc(parts[0])} is still free.` : "Check back later."}</p><a href="${res.status === "not_found" ? `/register?username=${encodeURIComponent(parts[0])}` : "/"}">${res.status === "not_found" ? "Claim it" : "Go home"}</a></div></div>`,
      });
      return true;
    }
    const p = res.payload;
    const page = parts[1] ?? null;
    if (page && !p.config.pages.some((x) => x.slug === page)) return false;
    const cfg = p.config;
    const name = cfg.identity.displayName || p.user.username;
    const title = cfg.seo.title || `${name} (@${p.user.username}) · LORN.LOL`;
    const desc = (cfg.seo.description || cfg.identity.bio || `${name} on LORN.LOL`).slice(0, 200);
    const og = (cfg.seo.ogImageAssetId && p.assets[cfg.seo.ogImageAssetId]?.url) || (cfg.avatar.assetId && p.assets[cfg.avatar.assetId]?.url) || null;
    const fav = cfg.seo.faviconAssetId && p.assets[cfg.seo.faviconAssetId]?.url;
    const url = `${app.cfg.appUrl}/${p.user.username}${page ? "/" + page : ""}`;
    const head = [
      `<meta name="description" content="${esc(desc)}">`, `<link rel="canonical" href="${esc(url)}">`,
      `<meta property="og:type" content="profile"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:site_name" content="LORN.LOL">`,
      og ? `<meta property="og:image" content="${esc(og)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(og)}">` : `<meta name="twitter:card" content="summary">`,
      `<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}">`,
      fav ? `<link rel="icon" href="${esc(fav)}">` : "",
      p.indexable ? "" : `<meta name="robots" content="noindex, nofollow">`,
      `<style nonce="${nonce}">html,body{margin:0;background:#020617}</style>`,
    ].join("");
    let body = "";
    try { body = renderToString(createElement(ProfileView, { payload: p as any, mode: "public", pageSlug: page })); }
    catch (e) { app.log.error("ssr failed", { err: (e as Error).stack }); }
    shell(app, c, {
      nonce, title, head, css: [m["profile.css"]].filter(Boolean), script: m["profile.js"],
      body: `<div id="lp-root">${body}</div><script type="application/json" id="lp-data">${embed({ payload: p, page })}</script>`,
    });
    return true;
  }

  // SPA routes
  const spa = parts.length === 0 || ["dashboard", "admin", "login", "register", "signup", "forgot-password", "reset-password", "verify-email", "terms", "privacy"].includes(parts[0]);
  if (!spa) return false;
  const titles: Record<string, string> = { "": "LORN.LOL — your corner of the internet", login: "Log in · LORN.LOL", register: "Create your page · LORN.LOL" };
  shell(app, c, {
    nonce, title: titles[parts[0] ?? ""] ?? "LORN.LOL", css: [m["app.css"]].filter(Boolean), script: m["app.js"],
    head: `<meta name="description" content="Build an animated profile page with music, badges, widgets and a live editor."><meta property="og:title" content="LORN.LOL"><meta property="og:description" content="Your corner of the internet.">${parts[0] === "admin" || parts[0] === "dashboard" ? `<meta name="robots" content="noindex">` : ""}`,
    body: `<div id="root"></div><noscript>LORN.LOL needs JavaScript.</noscript>`,
  });
  return true;
}
