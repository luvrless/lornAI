# lornAI ✦ Next-Generation AI Assistant (Claude UI Design)

An intelligent, multi-model AI assistant built in the design of **Claude.ai**, featuring instant low-latency streaming, vision image recognition, an expandable **150+ Skills Pack**, **Model Context Protocol (MCP)** with **Roblox Studio** support, and **Neon Auth / Discord OAuth** integration.

---

## ✨ Features & Architecture

- **Claude Dark Aesthetic by Default**: Deep charcoal/obsidian surfaces (`#181715`, `#22211E`), signature terracotta accents (`#DA7756`), and editorial serif typography.
- **Ultra-Fast Low-Latency Streaming**: Instantaneous token delivery with zero waiting time and automatic failover cascade.
- **Multimodal Vision**: Attach screenshots, diagrams, and photos—lornAI reads and analyzes visual details natively.
- **150+ Master Skills Pack**: Built-in master capabilities packed into a searchable catalog (Roblox Studio OOP, Game Systems, Python/FastAPI, AI/ML, Math, Strategy, Security, and Creative Writing).
- **Custom Skills Engine**: Add custom prompts, rules, and specialized behaviors that inject directly into the AI's system context.
- **Model Context Protocol (MCP)**: Connect local and remote MCP servers, including a pre-configured integration for **Roblox Studio MCP** (`http://127.0.0.1:3000/sse`) to automate Luau scripts and scene generation.
- **Authentication & Database**:
  - **Discord OAuth**: Configured for `https://lorn.lol/api/auth/callback/discord` with Cloudflare Pages Function.
  - **Neon Auth**: Support for Google Auth and Phone SMS Auth backed by Neon serverless Postgres.
  - **Account Tab**: Shows user profile, login provider, and session info.
- **Claude Live Artifacts Drawer**: Live sandboxed execution of interactive HTML/CSS/JS components, SVG diagrams, and syntax-highlighted code.
- **100% Sanitized & Private**: No API keys or internal endpoints are exposed in the UI or codebase. All personal keys and preferences stay strictly within local client storage.

---

## 🚀 How to Run Locally

```bash
cd C:\Users\jay2r\.gemini\antigravity\scratch\lornAI

# Direct launch:
start index.html

# Or with a local server:
npx serve .
```

---

## 🌐 Deploying to GitHub & Cloudflare Pages (lorn.lol)

### Step 1: Push to GitHub
```bash
git add -A
git commit -m "feat: ultra-fast lornAI with 150+ skills, MCP Roblox Studio, and Discord/Neon Auth"
git remote add origin https://github.com/<YOUR-USERNAME>/lornAI.git
git push -u origin main
```

### Step 2: Deploy with Cloudflare Pages
1. Go to **Cloudflare Dashboard** &rarr; **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**.
2. Select your `lornAI` repository.
3. Build Settings:
   - Framework preset: `None`
   - Build command: *(leave empty)*
   - Build output directory: `.`
4. In Cloudflare Pages Settings &rarr; **Custom Domains**, connect `lorn.lol`.
5. The Discord callback function located at `functions/api/auth/callback/discord.js` will automatically deploy on `https://lorn.lol/api/auth/callback/discord`.

---

## 🎮 Roblox Studio MCP Integration

To connect lornAI to Roblox Studio:
1. Start your local Roblox Studio MCP server (default: `http://127.0.0.1:3000/sse`).
2. Open lornAI &rarr; **Settings** &rarr; **MCP Servers**.
3. Ensure **Roblox Studio MCP Server** is enabled.
4. lornAI will generate and execute production Luau scripts formatted specifically for your Studio workflow!
