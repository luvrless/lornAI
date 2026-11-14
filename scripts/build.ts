/**
 * Production build: content-hashed client bundles (app + profile) with CSS,
 * a manifest for the server, and a bundled server entry (+ argon2 worker).
 * Usage: tsx scripts/build.ts [--watch]
 */
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("dist/web");
const watch = process.argv.includes("--watch");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const writeManifest = (meta: esbuild.Metafile) => {
  const m: Record<string, string> = {};
  for (const [file, info] of Object.entries(meta.outputs)) {
    if (!info.entryPoint && !file.endsWith(".css")) continue;
    const base = path.basename(file);
    const name = base.replace(/-[A-Z0-9]{8}(\.\w+)$/, "$1");
    if (/\.(js|css)$/.test(base)) m[name] = path.relative(out, file);
  }
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(m, null, 2));
  return m;
};

const client: esbuild.BuildOptions = {
  entryPoints: { app: "web/app/main.tsx", profile: "web/profile-client.tsx" },
  bundle: true, splitting: true, format: "esm", outdir: out, entryNames: "[name]-[hash]", chunkNames: "chunk-[hash]", assetNames: "[name]-[hash]",
  minify: !watch, sourcemap: true, target: ["es2022", "safari16"], jsx: "automatic", metafile: true,
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") }, legalComments: "none",
  loader: { ".woff2": "file", ".svg": "file", ".png": "file" },
};

if (watch) {
  const ctx = await esbuild.context({ ...client, plugins: [{ name: "manifest", setup(b) { b.onEnd((r) => { if (r.metafile) writeManifest(r.metafile); console.log(`[build] ${r.errors.length ? "errors" : "ok"} ${new Date().toLocaleTimeString()}`); }); } }] });
  await ctx.watch();
} else {
  const r = await esbuild.build(client);
  const m = writeManifest(r.metafile!);
  fs.cpSync("web/brand", path.join(out, "brand"), { recursive: true });
  const sizes = Object.entries(m).map(([k, v]) => `${k}: ${(fs.statSync(path.join(out, v)).size / 1024).toFixed(0)} KB`);
  console.log("client:", sizes.join(", "));
  // Server bundle (node deps stay external; they're installed alongside).
  await esbuild.build({
    entryPoints: { server: "server/main.ts", "argon2-worker": "server/lib/argon2-worker.ts" }, bundle: true, platform: "node", format: "esm", target: "node22",
    outdir: "dist", packages: "external", sourcemap: true, jsx: "automatic", banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  });
  fs.cpSync("server/db/migrations", "dist/migrations", { recursive: true });
  console.log("server: dist/server.js");
}
