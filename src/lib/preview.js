// Language auto-matching and live preview builders.
// Each code block's language is normalized, then matched to the best preview runtime:
//   html/svg → rendered page · css → styled demo page · js/ts → sandboxed console
//   jsx/tsx/react → React 18 renderer · python → Pyodide (CPython in WASM)
//   markdown → rendered doc · json → interactive tree · mermaid → diagram
// HTML previews automatically pull in sibling CSS/JS blocks from the same answer.

const ALIASES = {
  js: "javascript", mjs: "javascript", cjs: "javascript", node: "javascript",
  ts: "typescript", mts: "typescript",
  py: "python", python3: "python", py3: "python",
  htm: "html", xhtml: "html", vue: "html",
  md: "markdown", mdx: "markdown",
  sh: "bash", shell: "bash", zsh: "bash", console: "bash",
  yml: "yaml", "c++": "cpp", cc: "cpp", hpp: "cpp", h: "c",
  cs: "csharp", "c#": "csharp", rs: "rust", golang: "go", kt: "kotlin",
  rb: "ruby", rbxlua: "luau", roblox: "luau", "roblox-lua": "luau", ps1: "powershell", jsonc: "json", json5: "json",
  react: "jsx", scss: "scss", sass: "scss", less: "less", mmd: "mermaid",
  dockerfile: "dockerfile", docker: "dockerfile", tex: "latex", text: "plaintext", txt: "plaintext",
};

export const LANG_META = {
  html: { label: "HTML", color: "#e34c26", preview: "Web page" },
  css: { label: "CSS", color: "#2965f1", preview: "Style demo" },
  scss: { label: "SCSS", color: "#c6538c" },
  less: { label: "Less", color: "#1d365d" },
  javascript: { label: "JavaScript", color: "#f0db4f", preview: "JS console" },
  typescript: { label: "TypeScript", color: "#3178c6", preview: "TS console" },
  jsx: { label: "React JSX", color: "#61dafb", preview: "React app" },
  tsx: { label: "React TSX", color: "#61dafb", preview: "React app" },
  python: { label: "Python", color: "#3776ab", preview: "Python (Pyodide)" },
  svg: { label: "SVG", color: "#ffb13b", preview: "Image" },
  markdown: { label: "Markdown", color: "#7a7a7a", preview: "Document" },
  json: { label: "JSON", color: "#8bc34a", preview: "Tree viewer" },
  mermaid: { label: "Mermaid", color: "#ff3670", preview: "Diagram" },
  xml: { label: "XML", color: "#0060ac" },
  bash: { label: "Bash", color: "#4eaa25" },
  powershell: { label: "PowerShell", color: "#5391fe" },
  java: { label: "Java", color: "#b07219" },
  kotlin: { label: "Kotlin", color: "#a97bff" },
  c: { label: "C", color: "#555555" },
  cpp: { label: "C++", color: "#f34b7d" },
  csharp: { label: "C#", color: "#178600" },
  go: { label: "Go", color: "#00add8" },
  rust: { label: "Rust", color: "#dea584" },
  ruby: { label: "Ruby", color: "#cc342d" },
  php: { label: "PHP", color: "#777bb4" },
  swift: { label: "Swift", color: "#f05138" },
  dart: { label: "Dart", color: "#00b4ab" },
  lua: { label: "Lua", color: "#2c2d72", preview: "Lua 5.3 (Fengari)" },
  luau: { label: "Luau · Roblox", color: "#00a2ff" },
  sql: { label: "SQL", color: "#e38c00" },
  yaml: { label: "YAML", color: "#cb171e" },
  toml: { label: "TOML", color: "#9c4221" },
  dockerfile: { label: "Dockerfile", color: "#384d54" },
  r: { label: "R", color: "#198ce7" },
  latex: { label: "LaTeX", color: "#008080" },
  plaintext: { label: "Text", color: "#9ca3af" },
};

const EXT = {
  html: "html", css: "css", scss: "scss", less: "less", javascript: "js", typescript: "ts", jsx: "jsx", tsx: "tsx",
  python: "py", svg: "svg", markdown: "md", json: "json", mermaid: "mmd", xml: "xml", bash: "sh", powershell: "ps1",
  java: "java", kotlin: "kt", c: "c", cpp: "cpp", csharp: "cs", go: "go", rust: "rs", ruby: "rb", php: "php",
  swift: "swift", dart: "dart", lua: "lua", luau: "luau", sql: "sql", yaml: "yaml", toml: "toml", dockerfile: "Dockerfile", r: "r",
  latex: "tex", plaintext: "txt",
};

/** Normalize a fence language, auto-detecting from content when missing or generic. */
export function normalizeLang(raw, code = "") {
  let l = String(raw || "").trim().toLowerCase().split(/[\s{:]/)[0];
  l = ALIASES[l] || l;
  if (l === "javascript" && looksLikeJSX(code)) l = "jsx";
  if (l === "typescript" && looksLikeJSX(code)) l = "tsx";
  if (l === "lua" && /\bgame:GetService\(|\bInstance\.new\(|script\.Parent|--!strict|\btask\.(wait|spawn)/.test(code)) l = "luau";
  if (l === "xml" && /^\s*<svg[\s>]/i.test(code)) l = "svg";
  if (l === "html" && /^\s*<svg[\s>]/i.test(code) && !/<html|<body/i.test(code)) l = "svg";
  if (!l || l === "plaintext") return detect(code) || "plaintext";
  return l;
}

function looksLikeJSX(code) {
  return /from\s+['"]react['"]|<[A-Z][A-Za-z0-9]*[\s/>]|return\s*\(\s*<|ReactDOM|useState\(/.test(code);
}

function detect(code) {
  const c = code.trim();
  if (!c) return null;
  if (/^<!doctype html|^<html[\s>]/i.test(c) || /<(div|body|head|script|style)[\s>]/i.test(c)) return "html";
  if (/^<svg[\s>]/i.test(c)) return "svg";
  if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap)\b/.test(c)) return "mermaid";
  if (/^[\[{]/.test(c)) {
    try {
      JSON.parse(c);
      return "json";
    } catch {}
  }
  if (/\bgame:GetService\(|\bInstance\.new\(|\b(script\.Parent|workspace\.|task\.wait|:Connect\(|--!strict)/.test(c)) return "luau";
  if (/^\s*local\s+\w+\s*=|\bfunction\s+[\w.:]+\(.*\)[\s\S]*\bend\b|\bthen\b[\s\S]*\bend\b/m.test(c) && !/[{};]\s*$/m.test(c)) return "lua";
  if (/^(def |class |import |from \S+ import |print\()/m.test(c) && !/[;{}]\s*$/m.test(c)) return "python";
  if (looksLikeJSX(c)) return "jsx";
  if (/\b(const|let|function|=>|console\.log)\b/.test(c)) return "javascript";
  if (/^[.#]?[a-z-]+\s*\{[^}]*:[^}]*\}/im.test(c)) return "css";
  if (/^#include\s*</m.test(c)) return "cpp";
  if (/^package main|func main\(\)/m.test(c)) return "go";
  if (/^fn main\(\)|let mut /m.test(c)) return "rust";
  if (/public static void main|System\.out\.println/.test(c)) return "java";
  if (/^\s*(SELECT|INSERT|CREATE TABLE|UPDATE|DELETE)\b/im.test(c)) return "sql";
  if (/^#!\/bin\/(ba)?sh|^\s*(npm|pip|git|cd|sudo|apt|curl) /m.test(c)) return "bash";
  return null;
}

export const langLabel = (l) => LANG_META[l]?.label || (l ? l[0].toUpperCase() + l.slice(1) : "Code");
export const langColor = (l) => LANG_META[l]?.color || "#9ca3af";
export const fileNameFor = (l, i = 0) => (l === "dockerfile" ? "Dockerfile" : `${l === "jsx" || l === "tsx" ? "App" : i ? `snippet-${i + 1}` : "main"}.${EXT[l] || "txt"}`);

const PREVIEWABLE = new Set(["html", "svg", "css", "javascript", "typescript", "jsx", "tsx", "python", "markdown", "json", "mermaid", "lua"]);
export const canPreview = (l) => PREVIEWABLE.has(l);
export const previewLabel = (l) => LANG_META[l]?.preview || "Preview";

/** Parse fenced code blocks out of markdown (supports an unterminated last block while streaming). */
export function extractCodeBlocks(md) {
  const blocks = [];
  const lines = md.split("\n");
  let cur = null;
  for (const line of lines) {
    if (!cur) {
      const m = /^\s{0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/.exec(line);
      if (m) cur = { fence: m[1], rawLang: m[2], lines: [] };
    } else {
      const m = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (m && m[1][0] === cur.fence[0] && m[1].length >= cur.fence.length) {
        const code = cur.lines.join("\n");
        blocks.push({ rawLang: cur.rawLang, lang: normalizeLang(cur.rawLang, code), code, closed: true });
        cur = null;
      } else cur.lines.push(line);
    }
  }
  if (cur) {
    const code = cur.lines.join("\n");
    blocks.push({ rawLang: cur.rawLang, lang: normalizeLang(cur.rawLang, code), code, closed: false });
  }
  return blocks;
}

// ----------------------------------------------------------------------------------------------
const esc = (s) => s.replace(/<\/script/gi, "<\\/script");
// Embed arbitrary source as a JS string literal that can never break out of its <script>.
const lit = (s) => JSON.stringify(s).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

const BASE_STYLE = `
:root{color-scheme:light dark}
html,body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
`;

const CONSOLE_BRIDGE = `<script>
(function(){
  var send=function(level,args){try{parent.postMessage({__flair:1,level:level,args:[].map.call(args,function(a){
    if(a instanceof Error)return a.stack||String(a);
    if(typeof a==='object'){try{return JSON.stringify(a,null,2)}catch(e){return String(a)}}
    return String(a)})},'*')}catch(e){}};
  ['log','info','warn','error','debug'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o&&o.apply(console,arguments)}});
  window.addEventListener('error',function(e){send('error',[e.message+(e.lineno?' (line '+e.lineno+')':'')])});
  window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled promise rejection: '+(e.reason&&e.reason.message||e.reason)])});
})();
<\/script>`;

const TERMINAL = (title, dark = true) => `
<style>${BASE_STYLE}
body{background:${dark ? "#0f1117" : "#fff"};color:${dark ? "#e6e6e6" : "#111"};font:13px/1.55 "JetBrains Mono",ui-monospace,Menlo,monospace}
#bar{position:sticky;top:0;display:flex;align-items:center;gap:8px;padding:8px 14px;background:#161922;border-bottom:1px solid #262a36;color:#9aa3b5;font:12px Inter,system-ui,sans-serif}
#bar .d{width:8px;height:8px;border-radius:50%;background:#4d6bfe;box-shadow:0 0 0 0 rgba(77,107,254,.6);animation:p 1.4s infinite}
#bar.ok .d{background:#22c55e;animation:none}#bar.err .d{background:#ef4444;animation:none}
@keyframes p{70%{box-shadow:0 0 0 7px rgba(77,107,254,0)}}
#out{padding:12px 14px;white-space:pre-wrap;word-break:break-word}
.l{padding:1px 0;animation:f .25s ease}.warn{color:#fbbf24}.error{color:#f87171}.info{color:#60a5fa}.sys{color:#6b7280;font-style:italic}
@keyframes f{from{opacity:0;transform:translateY(3px)}}
</style>
<div id="bar"><span class="d"></span><span id="st">${title}</span></div><div id="out"></div>
<script>
(function(){var out=document.getElementById('out');
window.__print=function(level,text){var d=document.createElement('div');d.className='l '+level;d.textContent=text;out.appendChild(d);window.scrollTo(0,document.body.scrollHeight)};
window.__status=function(t,cls){document.getElementById('st').textContent=t;if(cls)document.getElementById('bar').className=cls};
['log','info','warn','error','debug'].forEach(function(k){var o=console[k];console[k]=function(){var a=[].map.call(arguments,function(x){
 if(x instanceof Error)return x.stack||String(x);if(typeof x==='object'&&x!==null){try{return JSON.stringify(x,null,2)}catch(e){return String(x)}}return String(x)}).join(' ');
 window.__print(k==='log'||k==='debug'?'':k,a);o&&o.apply(console,arguments)}});
window.addEventListener('error',function(e){window.__print('error',e.message);window.__status('Error','err')});
window.addEventListener('unhandledrejection',function(e){window.__print('error','Unhandled rejection: '+(e.reason&&e.reason.stack||e.reason))});
})();
<\/script>`;

function htmlDoc(code, siblings) {
  let doc = code;
  const css = siblings.filter((b) => b.lang === "css").map((b) => b.code).join("\n");
  const js = siblings.filter((b) => b.lang === "javascript").map((b) => b.code).join("\n;\n");
  const hasShell = /<html[\s>]/i.test(doc);
  if (!hasShell) doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${doc}</body></html>`;
  const headInject = CONSOLE_BRIDGE + (css ? `<style>${css}</style>` : "");
  doc = /<head[^>]*>/i.test(doc) ? doc.replace(/<head[^>]*>/i, (m) => m + headInject) : headInject + doc;
  if (js) {
    const tag = `<script>${esc(js)}<\/script>`;
    doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, tag + "</body>") : doc + tag;
  }
  return doc;
}

const CSS_DEMO = `
<header class="header"><nav class="nav"><a href="#" class="logo">Brand</a><ul><li><a href="#">Home</a></li><li><a href="#">About</a></li><li><a href="#">Contact</a></li></ul></nav></header>
<main class="container">
  <section class="hero"><h1>Heading One</h1><p class="lead">A short lead paragraph to show typography.</p>
  <button class="btn button primary">Primary</button> <button class="btn button secondary">Secondary</button></section>
  <div class="grid cards">${[1, 2, 3].map((i) => `<div class="card"><h3>Card ${i}</h3><p>Some example content inside a card element.</p><a href="#">Link</a></div>`).join("")}</div>
  <form class="form"><label>Email <input type="email" placeholder="you@example.com"></label><label>Message <textarea rows="3"></textarea></label><button type="button" class="btn">Submit</button></form>
  <div class="box"></div><div class="loader spinner"></div>
  <table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Alpha</td><td>1</td></tr><tr><td>Beta</td><td>2</td></tr></tbody></table>
</main><footer class="footer"><p>Footer text</p></footer>`;

function reactDoc(code, lang, siblings) {
  const css = siblings.filter((b) => b.lang === "css").map((b) => b.code).join("\n");
  const src = code
    .replace(/^\s*import\s+[^;]*?['"][^'"]+\.(css|scss|less|svg|png|jpg)['"];?\s*$/gm, "")
    .replace(/(from\s+|import\s+)(['"])(?![./]|https?:)([^'"]+)\2/g, (m, kw, q, spec) => {
      if (/^react(-dom)?(\/.*)?$/.test(spec)) return m;
      return `${kw}${q}https://esm.sh/${spec}?external=react,react-dom${q}`;
    });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${CONSOLE_BRIDGE}
<script type="importmap">{"imports":{
 "react":"https://esm.sh/react@18.3.1","react/":"https://esm.sh/react@18.3.1/",
 "react-dom":"https://esm.sh/react-dom@18.3.1","react-dom/":"https://esm.sh/react-dom@18.3.1/"}}<\/script>
<script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"><\/script>
<script src="https://cdn.tailwindcss.com/3.4.16"><\/script>
<style>${BASE_STYLE}${css}</style></head><body><div id="root"></div>
<script type="module">
const raw = ${lit(src)};
try {
  const out = Babel.transform(raw, { filename: 'App.${lang}', presets: [['react', { runtime: 'automatic' }]${lang === "tsx" ? ", ['typescript', { isTSX: true, allExtensions: true }]" : ""}] }).code;
  const url = URL.createObjectURL(new Blob([out], { type: 'text/javascript' }));
  const mod = await import(url);
  const root = document.getElementById('root');
  const C = mod.default || mod.App || Object.values(mod).find(v => typeof v === 'function');
  if (C && !root.hasChildNodes()) {
    const React = await import('react'); const { createRoot } = await import('react-dom/client');
    createRoot(root).render(React.createElement(C));
  }
} catch (e) { document.body.innerHTML = '<pre style="color:#ef4444;padding:16px;white-space:pre-wrap;font:13px monospace">' + String(e && e.message || e).replace(/</g,'&lt;') + '</pre>'; console.error(e); }
<\/script></body></html>`;
}

function jsDoc(code, lang) {
  const ts = lang === "typescript";
  return `<!doctype html><html><head><meta charset="utf-8">${ts ? '<script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"><\/script>' : ""}</head><body>
${TERMINAL(ts ? "Running TypeScript…" : "Running JavaScript…")}
<script>
(async function(){
  var code=${lit(code)}; var t0=performance.now();
  try{
    ${ts ? "code=Babel.transform(code,{filename:'main.ts',presets:[['typescript',{allExtensions:true}]]}).code;" : ""}
    var AsyncFn=Object.getPrototypeOf(async function(){}).constructor;
    var r=await (new AsyncFn(code))();
    if(r!==undefined)console.log(r);
    if(!document.getElementById('out').children.length)__print('sys','(no output)');
    __status('Finished in '+Math.round(performance.now()-t0)+' ms','ok');
  }catch(e){__print('error',e&&e.stack||String(e));__status('Error','err')}
})();
<\/script></body></html>`;
}

function pythonDoc(code) {
  return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"><\/script></head><body>
${TERMINAL("Loading Python runtime (Pyodide)…")}
<script>
(async function(){
  var code=${lit(code)};
  try{
    var py=await loadPyodide({stdout:function(s){__print('',s)},stderr:function(s){__print('error',s)}});
    py.setStdin({stdin:function(){return prompt('input()')||''}});
    __status('Installing imports…');
    try{await py.loadPackagesFromImports(code,{messageCallback:function(){}})}catch(e){}
    __status('Running Python…'); var t0=performance.now();
    var r=await py.runPythonAsync(code);
    if(r!==undefined&&r!==null)__print('',String(r));
    if(!document.getElementById('out').children.length)__print('sys','(no output)');
    __status('Finished in '+Math.round(performance.now()-t0)+' ms','ok');
  }catch(e){__print('error',String(e&&e.message||e));__status('Error','err')}
})();
<\/script></body></html>`;
}

function luaDoc(code) {
  return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/fengari-web@0.1.4/dist/fengari-web.js"><\/script></head><body>
${TERMINAL("Running Lua 5.3…")}
<script>
(function(){
  var code=${lit(code)}; var t0=performance.now();
  try{
    if(!window.fengari)throw new Error('Could not load the Lua runtime (fengari-web). Check your connection.');
    var lua=fengari.lua, lauxlib=fengari.lauxlib, lualib=fengari.lualib, toJS=fengari.to_luastring;
    var L=lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
    lua.lua_pushjsfunction(L,function(L){var n=lua.lua_gettop(L),parts=[];for(var i=1;i<=n;i++){parts.push(fengari.to_jsstring(lauxlib.luaL_tolstring(L,i)));lua.lua_pop(L,1)}__print('',parts.join('\\t'));return 0});
    lua.lua_setglobal(L,toJS('print'));
    var st=lauxlib.luaL_loadstring(L,toJS(code));
    if(st===lua.LUA_OK)st=lua.lua_pcall(L,0,lua.LUA_MULTRET,0);
    if(st!==lua.LUA_OK){__print('error',fengari.to_jsstring(lua.lua_tostring(L,-1)));__status('Error','err');return}
    if(!document.getElementById('out').children.length)__print('sys','(no output)');
    __status('Finished in '+Math.round(performance.now()-t0)+' ms','ok');
  }catch(e){__print('error',String(e&&e.message||e));__status('Error','err')}
})();
<\/script></body></html>`;
}

function markdownDoc(code) {
  return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"><\/script>
<style>${BASE_STYLE}body{max-width:760px;margin:0 auto;padding:28px;line-height:1.7;color:#1f2328}pre{background:#f6f8fa;padding:12px;border-radius:8px;overflow:auto}code{font-family:"JetBrains Mono",monospace;font-size:.9em}table{border-collapse:collapse}td,th{border:1px solid #d0d7de;padding:6px 12px}blockquote{border-left:4px solid #d0d7de;margin:0;padding-left:16px;color:#57606a}img{max-width:100%}
@media(prefers-color-scheme:dark){body{background:#0d1117;color:#e6edf3}pre{background:#161b22}td,th{border-color:#30363d}}</style></head>
<body><div id="d"></div><script>document.getElementById('d').innerHTML=marked.parse(${lit(code)})<\/script></body></html>`;
}

function jsonDoc(code) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}
body{font:13px/1.6 "JetBrains Mono",monospace;padding:14px;background:#fff;color:#1f2328}
details{margin-left:14px}summary{cursor:pointer;list-style:none}summary::before{content:'▸ ';color:#888}details[open]>summary::before{content:'▾ '}
.k{color:#7c3aed}.s{color:#16a34a}.n{color:#2563eb}.b{color:#d97706}.z{color:#9ca3af}.c{color:#9ca3af}.e{color:#dc2626;white-space:pre-wrap}
@media(prefers-color-scheme:dark){body{background:#0f1117;color:#e6e6e6}.k{color:#c4b5fd}.s{color:#86efac}.n{color:#93c5fd}}</style></head>
<body><div id="t"></div><script>
function h(s){return String(s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function v(x){if(x===null)return'<span class="z">null</span>';if(typeof x==='string')return'<span class="s">"'+h(x)+'"</span>';if(typeof x==='number')return'<span class="n">'+x+'</span>';if(typeof x==='boolean')return'<span class="b">'+x+'</span>';
var a=Array.isArray(x),ks=Object.keys(x),o=a?'[':'{',c=a?']':'}';if(!ks.length)return o+c;
return'<details open><summary>'+o+' <span class="c">'+ks.length+(a?' items':' keys')+'</span></summary>'+ks.map(function(k){return'<div style="margin-left:14px">'+(a?'':'<span class="k">"'+h(k)+'"</span>: ')+v(x[k])+'</div>'}).join('')+c+'</details>'}
try{document.getElementById('t').innerHTML=v(JSON.parse(${lit(code)}))}catch(e){document.getElementById('t').innerHTML='<div class="e">Invalid JSON: '+h(e.message)+'</div>'}
<\/script></body></html>`;
}

function mermaidDoc(code) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}body{display:flex;justify-content:center;padding:20px;background:#fff}@media(prefers-color-scheme:dark){body{background:#0f1117}}</style></head>
<body><pre class="mermaid">${code.replace(/</g, "&lt;")}</pre><script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs';
mermaid.initialize({startOnLoad:true,theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'default'});
<\/script></body></html>`;
}

/** Build an iframe srcdoc for a code block. `siblings` are other blocks of the same answer. */
export function buildPreview(block, siblings = []) {
  const { lang, code } = block;
  switch (lang) {
    case "html":
      return htmlDoc(code, siblings);
    case "svg":
      return `<!doctype html><html><head><style>${BASE_STYLE}body{min-height:100vh;display:grid;place-items:center;background:repeating-conic-gradient(#f3f4f6 0 25%,#fff 0 50%) 0 0/20px 20px}svg{max-width:92vw;max-height:92vh}</style></head><body>${code}</body></html>`;
    case "css":
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${CONSOLE_BRIDGE}<style>${code}</style></head><body>${
        siblings.find((b) => b.lang === "html")?.code || CSS_DEMO
      }</body></html>`;
    case "javascript":
    case "typescript":
      return jsDoc(code, lang);
    case "jsx":
    case "tsx":
      return reactDoc(code, lang, siblings);
    case "python":
      return pythonDoc(code);
    case "lua":
      return luaDoc(code);
    case "markdown":
      return markdownDoc(code);
    case "json":
      return jsonDoc(code);
    case "mermaid":
      return mermaidDoc(code);
    default:
      return null;
  }
}
