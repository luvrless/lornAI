import fs from "node:fs";
import path from "node:path";

const nextDir = path.resolve(".next");
const cacheDir = path.join(nextDir, "cache");

// 1. Remove .next/cache to prevent "Asset too large" error (Cloudflare 25 MiB limit)
if (fs.existsSync(cacheDir)) {
  console.log("Removing .next/cache to satisfy Cloudflare asset size limits...");
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

// 2. Copy generated HTML from .next/server/app to .next root for clean asset serving
const appServerDir = path.join(nextDir, "server", "app");
if (fs.existsSync(appServerDir)) {
  const copyHtmlFiles = (dir, prefix = "") => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        copyHtmlFiles(fullPath, path.join(prefix, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        const destName = prefix ? path.join(prefix, entry.name) : entry.name;
        const targetPath = path.join(nextDir, destName);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(fullPath, targetPath);
        console.log(`Prepared asset: ${destName}`);
      }
    }
  };
  copyHtmlFiles(appServerDir);
}

// 3. Copy public files into .next
const publicDir = path.resolve("public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, nextDir, { recursive: true });
}

// 4. Write .assetsignore to ensure no large or server files get scanned
const assetsIgnore = `cache/
cache/**
*.pack
*.map
node_modules/
`;
fs.writeFileSync(path.join(nextDir, ".assetsignore"), assetsIgnore);

console.log("Postbuild asset preparation complete!");
