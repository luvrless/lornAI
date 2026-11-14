/**
 * Vercel build (Build Output API v3). Run by Vercel as the build command:
 *   node scripts/vercel-build.mjs
 * Produces .vercel/output with:
 *   static/static/*            hashed client bundles, served by the CDN at /static/*
 *   functions/index.func/      the whole server as one Node function (+ sharp, migrations, argon2 worker)
 *   config.json                filesystem first, everything else → the function; daily cron
 * Plain JS so the build needs nothing beyond `npm install`.
 */
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(".vercel/output");
const STATIC = path.join(OUT, "static/static");
const FUNC = path.join(OUT, "functions/index.func");
const REGION = process.env.LORN_FUNCTION_REGION ?? "fra1";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(STATIC, { recursive: true });
fs.mkdirSync(FUNC, { recursive: true });

// ---- client
const client = await esbuild.build({
  entryPoints: { app: "web/app/main.tsx", profile: "web/profile-client.tsx" },
  bundle: true, splitting: true, format: "esm", outdir: STATIC, entryNames: "[name]-[hash]", chunkNames: "chunk-[hash]", assetNames: "[name]-[hash]",
  minify: true, sourcemap: false, target: ["es2022", "safari16"], jsx: "automatic", metafile: true, legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' }, loader: { ".woff2": "file", ".svg": "file", ".png": "file" },
});
const manifest = {};
for (const [file, info] of Object.entries(client.metafile.outputs)) {
  if (!info.entryPoint && !file.endsWith(".css")) continue;
  const base = path.basename(file);
  if (/\.(js|css)$/.test(base)) manifest[base.replace(/-[A-Z0-9]{8}(\.\w+)$/, "$1")] = path.relative(STATIC, file);
}
fs.writeFileSync(path.join(STATIC, "manifest.json"), JSON.stringify(manifest, null, 2));

// ---- server function (everything bundled except sharp's native module)
const banner = { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" };
await esbuild.build({
  entryPoints: { index: "server/vercel.ts", "argon2-worker": "server/lib/argon2-worker.ts" },
  bundle: true, platform: "node", format: "esm", target: "node22", outdir: FUNC, minify: true, sourcemap: false,
  jsx: "automatic", external: ["sharp"], banner, legalComments: "none",
});
fs.writeFileSync(path.join(FUNC, "package.json"), JSON.stringify({ type: "module" }));
fs.cpSync("server/db/migrations", path.join(FUNC, "migrations"), { recursive: true });
// The server reads the asset manifest to render pages; it runs with cwd = the function root.
fs.mkdirSync(path.join(FUNC, "public/static"), { recursive: true });
fs.copyFileSync(path.join(STATIC, "manifest.json"), path.join(FUNC, "public/static/manifest.json"));

// Copy sharp and its runtime dependency closure (incl. the platform binaries that got installed).
const seen = new Set();
/** Node's lookup: <from>/node_modules/<name>, then each parent directory. */
function findPkg(name, from) {
  for (let d = path.resolve(from); ; d = path.dirname(d)) {
    const cand = path.join(d, "node_modules", name, "package.json");
    if (fs.existsSync(cand)) return fs.realpathSync(cand);
    if (path.dirname(d) === d) return null;
  }
}
function copyPkg(name, from) {
  if (seen.has(name) || name.includes("musl") || name.includes("wasm32")) return; // Vercel runs glibc x64
  const pj = findPkg(name, from);
  if (!pj) return; // optional dependency for another platform
  seen.add(name);
  const dir = path.dirname(pj);
  fs.cpSync(dir, path.join(FUNC, "node_modules", name), { recursive: true, dereference: true });
  const meta = JSON.parse(fs.readFileSync(pj, "utf8"));
  for (const dep of Object.keys({ ...meta.dependencies, ...meta.optionalDependencies })) copyPkg(dep, dir);
}
copyPkg("sharp", process.cwd());

fs.writeFileSync(path.join(FUNC, ".vc-config.json"), JSON.stringify({
  runtime: "nodejs22.x", handler: "index.js", launcherType: "Nodejs", shouldAddHelpers: false,
  maxDuration: 60, memory: 1024, regions: [REGION],
}, null, 2));

fs.writeFileSync(path.join(OUT, "config.json"), JSON.stringify({
  version: 3,
  routes: [
    { src: "^/static/(.+)-[A-Za-z0-9]{8}\\.(js|css)$", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
    { src: "^/static/manifest\\.json$", status: 404 },
    { handle: "filesystem" },
    { src: "^/(.*)$", dest: "/index" },
  ],
  crons: [{ path: "/api/cron", schedule: "0 5 * * *" }],
}, null, 2));

const size = (d) => fs.readdirSync(d, { recursive: true }).reduce((n, f) => { const p = path.join(d, f); return n + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0); }, 0);
console.log(`client ${(size(STATIC) / 1024).toFixed(0)} KB · function ${(size(FUNC) / 1048576).toFixed(1)} MB · packages: ${[...seen].join(", ")}`);
