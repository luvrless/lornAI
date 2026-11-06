# lornAI ✦ Next-Generation AI with Claude UI Design

An advanced, responsive, and resilient AI assistant platform crafted with the signature aesthetic, typography, and interactive experience of **Claude.ai**. Powered by a multi-tier fallback engine supporting **Puter.js (Free Unlimited Claude 3.5/5.5 Sonnet & LLMs)**, **NVIDIA NIM API**, an **OpenAI rotating key pool**, and **Live Interactive Artifacts**.

![lornAI Claude Interface](favicon.svg)

---

## ✨ Key Highlights

- **Claude Signature Design System**: Warm ivory parchment aesthetic (`#FAF8F5`), Claude terracotta accents (`#DA7756`), editorial serif typography (*Newsreader* & *Instrument Serif*), subtle warm borders, and floating rounded squircle input card.
- **Interactive Live Artifacts Drawer**: Automatic detection of generated code blocks (HTML, CSS, JavaScript, SVG, Python). Features a split Code tab with syntax highlighting and a sandboxed **Live Preview** tab with instant rendering.
- **Multi-Tier Model Engine**:
  - **`lorn dts` Series (Flagship Reasoning & Deep Coding)**:
    - `lorn dts 5.0` – State-of-the-art flagship reasoning, multi-step logic (Claude 3.5/5.5 Sonnet & Nemotron 70B tier).
    - `lorn dts 4.5` – Ultra analysis, long-context writing, and synthesis (Claude Ultra / GPT-4o).
    - `lorn dts 4.0` – High-precision pro coding and analytical assistance.
    - `lorn dts 3.5` – Standard intelligent conversational daily driver.
  - **`lorn light` Series (High Speed & Efficiency)**:
    - `lorn light 4.5` – Blazing-fast Turbo speed with deep accuracy.
    - `lorn light 3.5` – Fast instruct model for translations and quick summaries.
    - `lorn light 2.5` – Ultra-compact nano-tier model.
    - `lorn light 1.5` – Micro instant responses for lightweight interaction.
- **Fail-Safe Multi-Provider Fallback**:
  - **Tier 1**: **Puter.js Cloud SDK** (Zero backend needed; client-side free unlimited Claude 3.5/5.5 Sonnet and LLM streaming).
  - **Tier 2**: **NVIDIA NIM API** (`integrate.api.nvidia.com`) preconfigured with the NVIDIA API key.
  - **Tier 3**: **50-Key Rotating OpenAI Key Pool** with automatic failover if rate limits (`429`) or quota exhausts.
  - **Tier 4**: Smart offline conversational safety net.
- **Full Chat Persistence**: LocalStorage multi-conversation manager with automatic time grouping (*Today*, *Yesterday*, *Previous 7 Days*), rename, search, delete, and copy.
- **Cloudflare Pages & GitHub Ready**: Self-contained client architecture with zero server requirements. Deployable with a single git push or direct drag-and-drop.

---

## 🚀 How to Run Locally

### Option 1: Direct File Launch
Simply double-click `index.html` in your browser. All dependencies (Puter.js SDK, Highlight.js, Marked.js, FontAwesome) load via secure CDNs.

### Option 2: Local HTTP Server
```bash
# With Node.js installed:
npx serve .

# Or with Python:
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) or [http://localhost:3000](http://localhost:3000).

---

## 🌐 Deploy to Cloudflare Pages & GitHub

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "feat: initial commit of lornAI Claude UI"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lornAI.git
git push -u origin main
```

### Step 2: Deploy on Cloudflare Pages
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation, click **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**.
3. Select your `lornAI` GitHub repository.
4. Set the build configuration:
   - **Framework preset**: None
   - **Build command**: *(leave completely blank)*
   - **Build output directory**: `.` *(or root)*
5. Click **Save and Deploy**. Your site will be live across Cloudflare's global edge network in seconds!

*(Alternatively: You can use Cloudflare Pages Direct Upload by dragging the project folder directly into the Cloudflare Pages web console).*

---

## ⚙️ Configuration & Key Rotation

Access the **Engine & Keys** menu by clicking the sliders icon in the bottom-left sidebar:
- **Default Model Tier**: Configure startup model from `lorn dts 5.0` to `lorn light 1.5`.
- **Temperature Slider**: Dial in creativity vs. precision.
- **NVIDIA NIM Key**: Preloaded with your NVIDIA key; can be updated anytime.
- **Key Rotation Pool**: 50 fallback API keys loaded. If an endpoint encounters a quota or rate-limit error, `lornAI` cascades through the pool without interrupting the conversation.
- **Custom System Persona**: Customize instructions for tone, formatting, and behavioral identity.

---

## 📄 License
MIT License. Free for personal and commercial usage.
