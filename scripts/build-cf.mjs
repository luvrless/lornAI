import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("dist/web");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

console.log("Building client bundles for Cloudflare Pages...");
const client = await esbuild.build({
  entryPoints: { app: "web/app/main.tsx", profile: "web/profile-client.tsx" },
  bundle: true,
  splitting: true,
  format: "esm",
  outdir: out,
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
  assetNames: "[name]-[hash]",
  minify: true,
  sourcemap: true,
  target: ["es2022", "safari16"],
  jsx: "automatic",
  metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  loader: { ".woff2": "file", ".svg": "file", ".png": "file" },
});

const manifest = {};
let appJs = "";
let appCss = "";
for (const [file, info] of Object.entries(client.metafile.outputs)) {
  if (!info.entryPoint && !file.endsWith(".css")) continue;
  const base = path.basename(file);
  const name = base.replace(/-[A-Z0-9]{8}(\.\w+)$/, "$1");
  if (/\.(js|css)$/.test(base)) {
    const rel = path.relative(out, file).replace(/\\/g, "/");
    manifest[name] = rel;
    if (name === "app.js") appJs = rel;
    if (name === "app.css") appCss = rel;
  }
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`Manifest: app.js=${appJs}, app.css=${appCss}`);

// Copy brand assets
fs.cpSync("web/brand", path.join(out, "brand"), { recursive: true });
fs.mkdirSync(path.join(out, "static"), { recursive: true });
fs.cpSync("web/brand", path.join(out, "static/brand"), { recursive: true });

// Copy all outputs also to static/ so /static/app-... works
for (const [name, rel] of Object.entries(manifest)) {
  const src = path.join(out, rel);
  const dst = path.join(out, "static", path.basename(rel));
  fs.copyFileSync(src, dst);
}
// Also copy chunks to static/
const files = fs.readdirSync(out);
for (const f of files) {
  if (f.startsWith("chunk-") && (f.endsWith(".js") || f.endsWith(".map"))) {
    fs.copyFileSync(path.join(out, f), path.join(out, "static", f));
  }
}

// Write index.html
const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#030716">
  <title>LORN.LOL — your corner of the internet</title>
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png">
  <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
  <meta name="description" content="Build an animated profile page with music, badges, widgets and a live editor.">
  <meta property="og:title" content="LORN.LOL">
  <meta property="og:description" content="Your corner of the internet.">
  <meta property="og:image" content="/brand/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="/brand/og.png">
  <link rel="stylesheet" href="/${appCss}">
</head>
<body class="app-bg">
  <div id="root"></div>
  <noscript>LORN.LOL needs JavaScript.</noscript>
  <script type="module" src="/${appJs}"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(out, "index.html"), indexHtml);
fs.writeFileSync(path.join(out, "404.html"), indexHtml);

// Write _redirects
const redirects = `/static/brand/*  /brand/:splat  200
/static/*        /:splat        200
/favicon.ico     /brand/favicon.ico 200
/*               /index.html    200
`;
fs.writeFileSync(path.join(out, "_redirects"), redirects);

// Copy functions to dist/web/functions
if (fs.existsSync("functions")) {
  fs.cpSync("functions", path.join(out, "functions"), { recursive: true });
}

console.log("Cloudflare Pages build complete!");
