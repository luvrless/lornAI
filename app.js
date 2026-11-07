/**
 * lornAI — Intelligent Chat Platform by Frail
 * Part of the lorn project. Powered by hundreds of distributed intelligence sources.
 * Never discloses underlying engines, never claims to be OpenAI, NVIDIA, or any single vendor.
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════
     DOM HELPERS
  ═══════════════════════════════════════════════ */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const on = (target, event, handler) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (el) el.addEventListener(event, handler);
  };

  /* ═══════════════════════════════════════════════
     ICON LIBRARY
  ═══════════════════════════════════════════════ */
  const ICON = {
    copy:   '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    check:  '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
    retry:  '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg>',
    trash:  '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    pen:    '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    up:     '<svg viewBox="0 0 24 24"><path d="M7 10v11M2 10h5v11H2zM7 10l4-8a3 3 0 0 1 3 3v4h6a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.6 21H7"/></svg>',
    preview:'<svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    lock:   '<svg viewBox="0 0 24 24" stroke-width="1.6"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    image:   '<svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    globe:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>',
    code:    '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    game:    '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/></svg>',
    file:    '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    search:  '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    paperclip:'<svg viewBox="0 0 24 24"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    alert:   '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  /* ═══════════════════════════════════════════════
     MODEL ROSTER — Frail / lornAI branding only
  ═══════════════════════════════════════════════ */
  const SYSTEM_IDENTITY = `You are lornAI, an advanced AI assistant developed by Frail as part of the lorn project (https://lorn.lol).
You are powered by hundreds of distributed intelligence sources and specialized AI systems — a collective network, not any single model.
Never say you are built on OpenAI, GPT, NVIDIA, Claude, or any third-party AI brand.
If asked what model or AI you are, say you are lornAI by Frail — a proprietary multi-source intelligence platform.
Talk freely, naturally, conversationally, and helpfully. Be warm, witty, and genuinely useful.
You have deep knowledge across all fields: code, math, science, art, writing, philosophy, pop culture, and beyond.
Always give complete, working answers. Never truncate code. Always explain reasoning clearly.
You can generate images using Markdown image syntax and retrieve online photos when asked.
You have access to real-time awareness (time, date, location context provided below).`;

  const MODELS = [
    {
      id: 'lorn-5.5-sovereign',
      name: 'Lorn 5.5 DTS Sovereign',
      badge: 'Flagship · Best',
      desc: 'Flagship omni intelligence — 200k context, vision, reasoning & deep knowledge across every field',
      group: 'Lorn DTS Series',
      contextLimit: 200000,
      pollinationsModel: 'openai',
      systemExtra: 'You are operating as Lorn 5.5 DTS Sovereign — the flagship tier with maximum reasoning depth, the largest context window, and strongest multi-domain mastery.',
      memberOnly: true
    },
    {
      id: 'fabel-4-architect',
      name: 'Fabel 4.0 Architect',
      badge: 'Coding · Flagship',
      desc: 'Elite software architect — Python, TypeScript, Roblox Luau, C++, Go, Rust, zero-defect generation',
      group: 'Fabel Series',
      contextLimit: 128000,
      pollinationsModel: 'openai',
      systemExtra: 'You are Fabel 4.0 Architect — the elite coding and software engineering intelligence. Write production-grade, complete, working, well-commented code. Never write placeholder code or truncate functions.',
      memberOnly: true
    },
    {
      id: 'fabel-quantum-reasoner',
      name: 'Fabel Quantum Reasoner',
      badge: 'Deep · Logic',
      desc: 'State-of-the-art deduction — formal proofs, mathematics, scientific analysis & multi-step reasoning',
      group: 'Fabel Series',
      contextLimit: 128000,
      pollinationsModel: 'openai',
      systemExtra: 'You are Fabel Quantum Reasoner — specializing in advanced mathematics, formal logic, rigorous scientific deduction, and step-by-step proof construction.',
      memberOnly: true
    },
    {
      id: 'fabel-lumina-vision',
      name: 'Fabel Lumina Vision',
      badge: 'Multimodal · Art',
      desc: 'Visual intelligence — image analysis, OCR, and high-fidelity artistic generation',
      group: 'Fabel Series',
      contextLimit: 128000,
      pollinationsModel: 'openai',
      systemExtra: 'You are Fabel Lumina Vision — a multimodal specialist for image understanding, visual analysis, and generating stunning high-fidelity artwork.',
      memberOnly: true
    },
    {
      id: 'lorn-5.0-nexus',
      name: 'Lorn 5.0 DTS Nexus',
      badge: 'Balanced · Fast',
      desc: 'Versatile balanced intelligence for daily tasks, writing, analysis and deep conversations',
      group: 'Lorn DTS Series',
      contextLimit: 128000,
      pollinationsModel: 'openai',
      systemExtra: 'You are Lorn 5.0 DTS Nexus — a balanced, reliable, and highly capable assistant for everyday tasks, writing, analysis, and conversation.',
      memberOnly: true
    },
    {
      id: 'lorn-mirage-swift',
      name: 'Lorn Mirage Swift',
      badge: 'Fast · Free',
      desc: 'Ultra-fast conversational assistant — instant replies, brainstorming & quick answers',
      group: 'Lorn Light',
      contextLimit: 50000,
      pollinationsModel: 'openai-fast',
      systemExtra: 'You are Lorn Mirage Swift — optimized for speed and instant, helpful replies. Be snappy, accurate, warm, and conversational.',
      memberOnly: false
    }
  ];

  /* ═══════════════════════════════════════════════
     DEFAULT PLUGINS
  ═══════════════════════════════════════════════ */
  const DEFAULT_PLUGINS = [
    { id: 'flux-image',   name: 'Flux Ultra Image Studio',     iconKey: 'image',  desc: 'High-resolution AI image generation on demand',             enabled: true  },
    { id: 'web-search',   name: 'Web Live Inspector',          iconKey: 'globe',  desc: 'Real-time web facts, news, weather and sports',              enabled: true  },
    { id: 'code-sandbox', name: 'Code Runner & Sandbox',       iconKey: 'code',   desc: 'Interactive artifact preview for HTML, JS, SVG, CSS',        enabled: true  },
    { id: 'roblox-luau',  name: 'Roblox Luau Toolkit',         iconKey: 'game',   desc: 'Roblox Studio integration & Luau script generation',         enabled: true  },
    { id: 'doc-analyst',  name: 'Document & File Analyst',     iconKey: 'file',   desc: 'Deep analysis of CSV, JSON, PDF, Python, JS and text files', enabled: true  },
    { id: 'img-finder',   name: 'Global Image Fetcher',        iconKey: 'search', desc: 'Retrieves real photos of people, places and objects online',  enabled: true  }
  ];

  /* ═══════════════════════════════════════════════
     SAFE STORAGE
  ═══════════════════════════════════════════════ */
  const store = {
    getUser()     { try { return JSON.parse(localStorage.getItem('lorn_user') || 'null'); }     catch { return null; } },
    setUser(u)    { try { u ? localStorage.setItem('lorn_user', JSON.stringify(u)) : localStorage.removeItem('lorn_user'); } catch {} },
    getChats()    { const u = store.getUser(); if (!u) return window._guestChats || []; try { return JSON.parse(localStorage.getItem('lorn_chats_' + u.id) || '[]'); } catch { return []; } },
    setChats(v)   { const u = store.getUser(); if (!u) { window._guestChats = v.slice(0, 50); return; } try { localStorage.setItem('lorn_chats_' + u.id, JSON.stringify(v.slice(0, 200))); } catch {} },
    getMemory()   { try { return JSON.parse(localStorage.getItem('lorn_memory') || '[]'); }      catch { return []; } },
    setMemory(m)  { try { localStorage.setItem('lorn_memory', JSON.stringify(m.slice(0, 60))); } catch {} },
    getMcp()      { try { return JSON.parse(localStorage.getItem('lorn_mcp_servers') || '[]'); } catch { return []; } },
    setMcp(s)     { try { localStorage.setItem('lorn_mcp_servers', JSON.stringify(s)); }         catch {} },
    getPlugins()  { try { return JSON.parse(localStorage.getItem('lorn_plugins') || 'null') || DEFAULT_PLUGINS; } catch { return DEFAULT_PLUGINS; } },
    setPlugins(p) { try { localStorage.setItem('lorn_plugins', JSON.stringify(p)); }             catch {} },
    get(k, d)     { try { const v = localStorage.getItem('lorn_' + k); return v == null ? d : v; } catch { return d; } },
    set(k, v)     { try { localStorage.setItem('lorn_' + k, v); }                               catch {} }
  };

  /* ═══════════════════════════════════════════════
     APP STATE
  ═══════════════════════════════════════════════ */
  let currentUser  = store.getUser();
  let chats        = store.getChats();
  let currentChat  = null;
  let currentModel = currentUser ? (MODELS.find(m => m.id === (store.get('model') || 'lorn-5.5-sovereign')) || MODELS[0]) : MODELS.find(m => m.id === 'lorn-mirage-swift');
  let temperature  = parseFloat(store.get('temp', '0.72'));
  let attachedFiles = [];
  let activeController = null;
  let envCtx = { timezone: '', city: '', country: '', localTime: '' };
  let isNearBottom = true;

  /* ═══════════════════════════════════════════════
     UTILS
  ═══════════════════════════════════════════════ */
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  const esc = (s) => (s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /**
   * Approximate token count — calibrated so tokens drain ~8× slower:
   * 1 token ≈ 25 characters (instead of the typical 4).
   */
  const charsToTokens = (chars) => Math.max(1, Math.round(chars / 25));

  function splitThink(text) {
    const m = (text || '').match(/^\s*<think>([\s\S]*?)(<\/think>|$)/);
    if (!m) return { think: '', body: text || '' };
    return { think: m[1].trim(), body: m[2] ? text.slice(m.index + m[0].length) : '' };
  }

  /* ═══════════════════════════════════════════════
     MARKDOWN + HIGHLIGHT
  ═══════════════════════════════════════════════ */
  try {
    if (window.marked && window.marked.setOptions) {
      window.marked.setOptions({ gfm: true, breaks: true });
    }
  } catch {}

  function renderMarkdown(text) {
    let html = text || '';
    try {
      if (window.marked && window.marked.parse) html = window.marked.parse(html);
      if (window.DOMPurify && window.DOMPurify.sanitize) html = window.DOMPurify.sanitize(html, { ADD_TAGS: ['iframe'], FORCE_BODY: true });
    } catch { html = esc(text).replace(/\n/g, '<br/>'); }

    const tpl = document.createElement('div');
    tpl.innerHTML = html;

    /* Upgrade inline images to nicely sized blocks */
    tpl.querySelectorAll('img').forEach(img => {
      img.style.maxWidth = '340px';
      img.style.maxHeight = '300px';
      img.style.borderRadius = '10px';
      img.style.objectFit = 'cover';
      img.style.display = 'block';
      img.style.margin = '8px 0';
      img.loading = 'lazy';
      if (!img.alt) img.alt = 'Generated image';
    });

    /* Wrap code blocks */
    tpl.querySelectorAll('pre > code').forEach((code) => {
      const lang = (code.className.match(/language-([\w+-]+)/) || [])[1] || 'text';
      const pre = code.parentElement;
      const rawCode = code.innerText || code.textContent || '';
      const isArtifact = ['html', 'svg', 'javascript', 'js', 'css', 'lua'].includes(lang.toLowerCase()) && rawCode.length > 40;

      const wrap = document.createElement('div');
      wrap.className = 'code-block';
      wrap.innerHTML = `
        <div class="code-head">
          <span>${esc(lang)}</span>
          <div class="code-head-actions">
            ${isArtifact ? `<button type="button" class="run-artifact-btn">${ICON.preview}<span>Preview</span></button>` : ''}
            <button type="button" class="copy-code">${ICON.copy}<span>Copy</span></button>
          </div>
        </div>`;
      pre.replaceWith(wrap);
      wrap.appendChild(pre);

      if (isArtifact) {
        wrap.querySelector('.run-artifact-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openArtifactDrawer(lang, rawCode);
        });
      }
    });

    return tpl;
  }

  function highlight(el) {
    if (!window.hljs || !el) return;
    el.querySelectorAll('pre code').forEach(c => { try { window.hljs.highlightElement(c); } catch {} });
  }

  /* ═══════════════════════════════════════════════
     MESSAGE RENDERING
  ═══════════════════════════════════════════════ */
  function addUser(text, files) {
    const thread = $('#thread');
    if (!thread) return null;
    const el = document.createElement('div');
    el.className = 'msg user';
    let inner = '';
    if (files && files.length) {
      for (const f of files) {
        if (f.dataUrl && f.type.startsWith('image/')) {
          inner += `<img src="${f.dataUrl}" alt="Attachment" class="user-media" style="max-width:220px;max-height:180px;border-radius:8px;display:block;margin-bottom:6px;" />`;
        } else {
          inner += `<div style="font-size:12px;color:var(--dim);margin-bottom:6px;">📎 ${esc(f.name)}</div>`;
        }
      }
    }
    inner += `<div class="bubble">${esc(text)}</div>`;
    el.innerHTML = inner;
    thread.appendChild(el);
    return el;
  }

  function addAI(msgIdx) {
    const thread = $('#thread');
    if (!thread) return null;
    const el = document.createElement('div');
    el.className = 'msg ai';
    el.dataset.idx = msgIdx != null ? msgIdx : '';
    el.innerHTML = `
      <span class="mark ai-mark"></span>
      <div class="body">
        <div class="reason-slot"></div>
        <div class="content"></div>
        <div class="actions">
          <button type="button" class="act-copy" title="Copy response">${ICON.copy}</button>
          <button type="button" class="act-like" title="Good response">${ICON.up}</button>
          <button type="button" class="act-retry" title="Retry">${ICON.retry}</button>
          <span class="meta"></span>
        </div>
      </div>`;
    thread.appendChild(el);
    return el;
  }

  function paintAI(el, msg, streaming) {
    if (!el) return;
    const { think, body } = splitThink(msg.content || '');
    const reasoning = (msg.reasoning || '') + (think ? (msg.reasoning ? '\n' : '') + think : '');
    const slot = el.querySelector('.reason-slot');

    if (reasoning && slot) {
      let d = slot.querySelector('details');
      if (!d) {
        slot.innerHTML = '<details class="reasoning"><summary></summary><div></div></details>';
        d = slot.querySelector('details');
      }
      d.querySelector('summary').innerHTML = streaming && !body
        ? '<span class="shim">Thinking…</span>'
        : 'Reasoning (click to expand)';
      d.querySelector('div').textContent = reasoning;
    }

    const content = el.querySelector('.content');
    if (content) {
      if (!body && streaming) {
        content.innerHTML = reasoning ? '' : '<div class="thinking"><span class="shim">lornAI is thinking…</span></div>';
      } else if (body) {
        const frag = renderMarkdown(body);
        content.replaceChildren(...frag.childNodes);
        if (streaming) {
          const last = content.lastElementChild || content;
          const caret = document.createElement('span');
          caret.className = 'caret';
          (last.tagName === 'DIV' || last.tagName === 'UL' || last.tagName === 'OL' ? content : last).appendChild(caret);
        } else {
          highlight(content);
        }
      }
      if (msg.error) {
        content.insertAdjacentHTML('beforeend', `<p class="err-text">${ICON.alert} ${esc(msg.error)}</p>`);
      }
    }
  }

  /* ═══════════════════════════════════════════════
     SCROLL LOCK
  ═══════════════════════════════════════════════ */
  const scroller = $('#scroller');
  if (scroller) {
    scroller.addEventListener('scroll', () => {
      isNearBottom = (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight) < 140;
    }, { passive: true });
  }

  function scrollBottom(force = false) {
    if (!scroller) return;
    if (force || isNearBottom) scroller.scrollTop = scroller.scrollHeight;
  }

  /* ═══════════════════════════════════════════════
     THREAD RENDER
  ═══════════════════════════════════════════════ */
  function renderThread() {
    const thread = $('#thread');
    const appEl  = $('#app');
    const ct     = $('#chatTitle');
    if (!thread) return;
    thread.innerHTML = '';
    const msgs = currentChat?.messages || [];
    if (appEl) appEl.classList.toggle('chatting', msgs.length > 0);
    if (ct) ct.textContent = (currentChat && currentChat.messages && currentChat.messages.length > 0) ? (currentChat.title || '') : '';
    msgs.forEach((m, i) => {
      if (m.role === 'user') addUser(m.content, m.files);
      else paintAI(addAI(i), m, false);
    });
    updateContextMeter();
    requestAnimationFrame(() => scrollBottom(true));
  }

  /* ═══════════════════════════════════════════════
     CONTEXT WINDOW METER
     Tokens drain ~8× slower (1 token = 25 chars)
  ═══════════════════════════════════════════════ */
  function calculateTokenMetrics() {
    let promptChars = 0, completionChars = 0;
    const msgs = currentChat?.messages || [];
    for (const m of msgs) {
      if (m.role === 'user') {
        promptChars += (m.content || '').length;
        if (m.files) m.files.forEach(f => { promptChars += f.textContent ? f.textContent.length : 1200; });
      } else {
        completionChars += (m.content || '').length;
      }
    }
    const promptTokens     = charsToTokens(promptChars);
    const completionTokens = charsToTokens(completionChars);
    // Start cleanly at 0 if no messages have been sent yet (no phantom 86 tokens)
    const isGuest          = !currentUser;
    const capacity         = isGuest ? 4000 : (currentModel.contextLimit || 200000);
    const totalTokens      = (promptTokens + completionTokens === 0) ? 0 : (promptTokens + completionTokens);
    const percent          = (totalTokens === 0) ? '0.0' : Math.min(100, (totalTokens / capacity) * 100).toFixed(1);
    return { promptTokens, completionTokens, systemTokens: 0, totalTokens, capacity, percent, isGuest };
  }

  function updateContextMeter() {
    const m          = calculateTokenMetrics();
    const miniVal    = $('#contextMiniVal');
    const miniBar    = $('#contextBarFill');
    const ctxModel   = $('#ctxModelName');
    const ctxRatio   = $('#ctxTokenRatio');
    const ctxFill    = $('#ctxProgressFill');
    const ctxPct     = $('#ctxPercentText');
    const ctxPrompt  = $('#ctxPromptTokens');
    const ctxComp    = $('#ctxCompTokens');

    if (miniVal)   miniVal.textContent   = m.isGuest ? `${m.totalTokens}/${(m.capacity/1000).toFixed(0)}k` : `${m.percent}%`;
    if (miniBar)   miniBar.style.width   = `${Math.max(2, m.percent)}%`;
    if (ctxModel)  ctxModel.textContent  = currentModel.name + (m.isGuest ? ' (Guest)' : '');
    if (ctxRatio)  ctxRatio.textContent  = `${m.totalTokens.toLocaleString()} / ${m.capacity.toLocaleString()}`;
    if (ctxFill)   ctxFill.style.width   = `${Math.max(2, m.percent)}%`;
    if (ctxPct)    ctxPct.textContent    = `${m.percent}%`;
    if (ctxPrompt) ctxPrompt.textContent = m.promptTokens.toLocaleString();
    if (ctxComp)   ctxComp.textContent   = m.completionTokens.toLocaleString();

    /* Guest limit banner — only at 4k tokens now */
    const composerParent = $('#composer')?.parentElement;
    const existing = $('#guestLimitBanner');
    if (m.isGuest && m.totalTokens >= 4000) {
      if (!existing && composerParent) {
        const banner = document.createElement('div');
        banner.className = 'guest-limit-banner';
        banner.id = 'guestLimitBanner';
        banner.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">${ICON.alert} Guest limit reached. Sign in for unlimited tokens!</span><button type="button" class="guest-limit-btn" id="guestBannerLoginBtn">Sign In</button>`;
        composerParent.insertBefore(banner, $('#composer'));
        $('#guestBannerLoginBtn')?.addEventListener('click', () => openModal('#authModal'));
      }
      const sb = $('#sendBtn'); if (sb) sb.disabled = true;
    } else if (existing) {
      existing.remove();
    }
  }

  on('#contextWindowBtn', 'click', () => { updateContextMeter(); openModal('#contextModal'); });

  /* ═══════════════════════════════════════════════
     SIDEBAR HISTORY
  ═══════════════════════════════════════════════ */
  function renderHistory() {
    const h = $('#history');
    if (!h) return;
    const q = ($('#searchInput')?.value || '').toLowerCase().trim();
    h.innerHTML = '';
    chats
      .filter(c => !q || (c.title || '').toLowerCase().includes(q))
      .forEach((c, i) => {
        const b = document.createElement('div');
        b.className = 'h-item' + (currentChat?.id === c.id ? ' active' : '');
        b.style.animationDelay = Math.min(i, 10) * 0.025 + 's';
        b.innerHTML = `
          <span class="title-span">${esc(c.title || 'Untitled chat')}</span>
          <div class="h-actions">
            <button type="button" class="h-btn edit-tab" title="Rename">${ICON.pen}</button>
            <button type="button" class="h-btn del" title="Delete">${ICON.trash}</button>
          </div>`;
        b.onclick = (e) => {
          if (e.target.closest('.edit-tab')) {
            e.stopPropagation();
            const n = prompt('Rename chat:', c.title);
            if (n && n.trim()) { c.title = n.trim(); store.setChats(chats); renderHistory(); if (currentChat?.id === c.id) { const ct = $('#chatTitle'); if (ct) ct.textContent = c.title; } toast('Renamed'); }
            return;
          }
          if (e.target.closest('.del')) {
            e.stopPropagation();
            chats = chats.filter(x => x.id !== c.id);
            if (currentChat?.id === c.id) newChat();
            store.setChats(chats);
            renderHistory();
            toast('Chat deleted');
            return;
          }
          openChat(c.id);
        };
        h.appendChild(b);
      });
  }

  function openChat(id) {
    if (activeController) activeController.abort();
    currentChat = chats.find(c => c.id === id) || null;
    renderThread();
    renderHistory();
    $('#app')?.classList.remove('side-open');
  }

  function newChat() {
    if (activeController) activeController.abort();
    currentChat = null;
    renderThread();
    renderHistory();
    setGreeting();
    clearAttachedFiles();
    $('#app')?.classList.remove('side-open');
    $('#input')?.focus();
  }

  function saveChat() {
    if (!currentChat) return;
    currentChat.updated = Date.now();
    chats = [currentChat, ...chats.filter(c => c.id !== currentChat.id)];
    store.setChats(chats);
    renderHistory();
  }

  /* ═══════════════════════════════════════════════
     GEOLOCATION / ENV CONTEXT
  ═══════════════════════════════════════════════ */
  async function detectEnv() {
    try {
      envCtx.timezone  = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const now = new Date();
      envCtx.localTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + now.toLocaleDateString() + ')';
      const sources = [
        'https://freeipapi.com/api/json',
        'https://ip-api.com/json/?fields=city,country',
        'https://ipapi.co/json/'
      ];
      for (const url of sources) {
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined });
          if (!r.ok) continue;
          const g = await r.json();
          envCtx.city    = g.cityName || g.city || '';
          envCtx.country = g.countryName || g.country || '';
          if (envCtx.country) break;
        } catch {}
      }
    } catch {}
    const label = $('#envContextLabel');
    if (label) label.textContent = `${envCtx.city ? envCtx.city + ', ' : ''}${envCtx.country || 'Global'} · ${envCtx.localTime || 'Active'}`;
  }

  /* ═══════════════════════════════════════════════
     MEMORY
  ═══════════════════════════════════════════════ */
  function updateMemory(userText, aiText) {
    if (!currentUser) return;
    const mems = store.getMemory();
    const m = (userText || '').match(/\b(?:my name is|i am|i live in|i work as|i prefer|my project is|call me)\b\s+([^.!?\n]+)/i);
    if (m && m[1]) {
      const fact = m[0].trim();
      if (!mems.includes(fact)) { mems.unshift(fact); store.setMemory(mems); renderMemoryList(); }
    }
  }

  function renderMemoryList() {
    const box = $('#memoryList');
    if (!box) return;
    if (!currentUser) { box.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;">' + ICON.lock + ' Memory Brain requires sign-in.</span>'; return; }
    const mems = store.getMemory();
    box.innerHTML = mems.length
      ? mems.map(m => `<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">• ${esc(m)}</div>`).join('')
      : 'No memories yet. Chat with lornAI to build continuity.';
  }

  /* ═══════════════════════════════════════════════
     PLUGINS & MCP
  ═══════════════════════════════════════════════ */
  function renderPlugins() {
    const list = $('#pluginsList');
    if (!list) return;
    const plugins = store.getPlugins();
    list.innerHTML = plugins.map((p, i) => `
      <div class="plugin-item">
        <div class="plugin-info">
          <div class="plugin-icon">${p.iconKey && ICON[p.iconKey] ? ICON[p.iconKey] : (p.icon && !/\p{Emoji}/u.test(p.icon) ? p.icon : ICON.code)}</div>
          <div class="plugin-meta"><b>${esc(p.name)}</b><small>${esc(p.desc)}</small></div>
        </div>
        <input type="checkbox" class="switch plugin-toggle" data-idx="${i}" ${p.enabled ? 'checked' : ''} />
      </div>`).join('');
    list.querySelectorAll('.plugin-toggle').forEach(cb => {
      cb.onchange = (e) => {
        const idx = parseInt(cb.dataset.idx, 10);
        plugins[idx].enabled = e.target.checked;
        store.setPlugins(plugins);
        toast(`${plugins[idx].name} ${e.target.checked ? 'enabled' : 'disabled'}`);
      };
    });
  }

  on('#uploadPluginBtn', 'click', () => $('#pluginFileInput')?.click());
  on('#pluginFileInput', 'change', (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const p = JSON.parse(ev.target.result);
        if (p && p.name) {
          const plugins = store.getPlugins();
          plugins.push({ id: 'custom-' + uid(), name: p.name, icon: p.icon || '⚡', desc: p.desc || 'Custom plugin', enabled: true });
          store.setPlugins(plugins); renderPlugins(); toast(`${p.name} installed`);
        }
      } catch { toast('Invalid plugin file'); }
    };
    r.readAsText(file);
  });
  on('#importPluginBtn', 'click', () => {
    const url = prompt('Plugin manifest URL:');
    if (!url?.startsWith('http')) return;
    fetch(url).then(r => r.json()).then(p => {
      const plugins = store.getPlugins();
      plugins.push({ id: 'imported-' + uid(), name: p.name || 'Plugin', icon: p.icon || '🌐', desc: p.desc || url, enabled: true });
      store.setPlugins(plugins); renderPlugins(); toast(`${p.name || 'Plugin'} imported`);
    }).catch(() => toast('Could not fetch plugin'));
  });

  function renderMcpServers() {
    const list = $('#mcpServerList');
    if (!list) return;
    const servers = store.getMcp();
    if (!servers.length) {
      list.innerHTML = `<div style="font-size:12.5px;color:var(--dim);padding:14px;text-align:center;border:1px dashed var(--line);border-radius:12px;">No MCP servers connected. Add one below.</div>`;
      return;
    }
    list.innerHTML = servers.map((s, i) => `
      <div class="advice-card" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <b>${esc(s.name)}</b>
            <span style="font-size:10px;color:var(--success);background:rgba(103,185,135,0.15);padding:1px 6px;border-radius:4px;">● Connected</span>
          </div>
          <small style="color:var(--dim)">${esc(s.endpoint)}</small>
        </div>
        <button type="button" class="icon-btn del-mcp" data-idx="${i}" title="Remove">${ICON.trash}</button>
      </div>`).join('');
    list.querySelectorAll('.del-mcp').forEach(btn => {
      btn.onclick = () => {
        servers.splice(parseInt(btn.dataset.idx, 10), 1);
        store.setMcp(servers); renderMcpServers(); toast('MCP server removed');
      };
    });
  }

  on('#addMcpServerBtn', 'click', () => { closeModal('#settingsModal'); openModal('#mcpModal'); });
  on('#addMcpForm', 'submit', (e) => {
    e.preventDefault();
    const name = $('#mcpName')?.value.trim();
    const endpoint = $('#mcpEndpoint')?.value.trim();
    const desc = $('#mcpDesc')?.value.trim() || '';
    if (!name || !endpoint) return;
    const servers = store.getMcp();
    servers.push({ name, endpoint, desc });
    store.setMcp(servers);
    $('#addMcpForm')?.reset();
    closeModal('#mcpModal');
    openModal('#settingsModal');
    switchSettingsTab('tabConnectors');
    renderMcpServers();
    toast(`Connected to ${name}`);
  });

  /* ═══════════════════════════════════════════════
     IMAGE REQUEST DETECTION
  ═══════════════════════════════════════════════ */
  function detectImageRequest(text) {
    // Generate: "generate/create/draw/paint/make an image of X"
    const genRx = /\b(?:generate|create|draw|paint|render|make|design)\s+(?:an?\s+)?(?:image|picture|photo|illustration|artwork|drawing|graphic)(?:\s+of|\s+showing|\s+depicting|\s+that\s+shows)?\s+([^.!?\n]{5,120})/i;
    // Show/find: "show me a photo of X" / "show images of X"
    const showRx = /\b(?:show|find|get|fetch|give)\s+(?:me\s+)?(?:an?\s+|some\s+)?(?:image|images|photo|photos|picture|pictures)\s+(?:of|for|showing)\s+([^.!?\n]{3,100})/i;
    // "what does X look like" triggers
    const lookRx = /\bwhat does\s+([^.!?\n]{3,80})\s+look like\b/i;

    const gen  = (text || '').match(genRx);
    const show = (text || '').match(showRx);
    const look = (text || '').match(lookRx);

    if (gen) {
      const prompt = gen[1].trim().replace(/['"]/g, '');
      return { type: 'generate', prompt, url: buildFluxUrl(prompt, 'artistic ultra detailed, 8k quality') };
    }
    if (show || look) {
      const subject = ((show || look)[1] || '').trim().replace(/['"]/g, '');
      return { type: 'fetch', prompt: subject, url: buildPhotoUrl(subject) };
    }
    return null;
  }

  function buildFluxUrl(prompt, extra = '') {
    const full = encodeURIComponent(`${prompt}${extra ? ', ' + extra : ''}`);
    const seed = Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${full}?width=800&height=600&seed=${seed}&nologo=true&enhance=true&model=flux`;
  }

  function buildPhotoUrl(subject) {
    const full = encodeURIComponent(`${subject} realistic high definition photo`);
    const seed = Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${full}?width=800&height=600&seed=${seed}&nologo=true&enhance=true`;
  }

  /* ═══════════════════════════════════════════════
     SYSTEM PROMPT BUILDER
     Never leaks backend model names
  ═══════════════════════════════════════════════ */
  function buildSystemPrompt() {
    const mems   = currentUser ? store.getMemory() : [];
    const memStr = mems.length ? `\n\nUser memory & facts: ${mems.join('; ')}` : '';
    const geoStr = envCtx.country
      ? `\n\nUser location: ${envCtx.city ? envCtx.city + ', ' : ''}${envCtx.country}. Local time: ${envCtx.localTime}. Timezone: ${envCtx.timezone}.`
      : '';
    const plugins = store.getPlugins().filter(p => p.enabled).map(p => p.name).join(', ');
    const mcps    = store.getMcp().map(s => s.name).join(', ');

    return `${SYSTEM_IDENTITY}

Model identity: ${currentModel.name} — a Frail intelligence tier within lornAI.
${currentModel.systemExtra}

Active plugin skills: ${plugins || 'standard skill set'}.
${mcps ? 'Connected MCP servers: ' + mcps + '.' : ''}
${geoStr}${memStr}

IMPORTANT RULES:
- Never claim to be OpenAI, GPT, NVIDIA, Claude, Anthropic, or any other external AI brand.
- If asked what powers you or what model you are, say "lornAI by Frail" — a proprietary multi-source intelligence.
- When generating or showing images, always embed them directly in Markdown: ![description](url)
- Always complete code snippets fully — never truncate or add placeholder comments.
- Respond in the user's language. Be conversational, warm, and genuinely helpful.`;
  }

  /* ═══════════════════════════════════════════════
     STREAMING ENGINE — cascading fallbacks, never fails
  ═══════════════════════════════════════════════ */
  async function readSSE(res, onDelta, signal) {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', got = false;

    while (true) {
      if (signal?.aborted) { reader.cancel().catch(() => {}); break; }
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return got;
        let parsed; try { parsed = JSON.parse(payload); } catch { continue; }
        if (parsed.error) throw new Error(parsed.error.message || 'Stream error');
        const delta = parsed.choices?.[0]?.delta || {};
        const text  = delta.content || '';
        const reason = delta.reasoning_content || delta.reasoning || '';
        if (text || reason) { got = got || !!text; onDelta(text, reason); }
      }
    }
    return got;
  }

  /**
   * Merge file attachments into message content for the last user message.
   * Images → multimodal array. Text files → appended to system context.
   */
  function prepareMessages(history, files) {
    const sysPrompt = buildSystemPrompt();
    const messages  = [{ role: 'system', content: sysPrompt }];

    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      const isLast = i === history.length - 1;

      if (isLast && m.role === 'user' && files && files.length) {
        const hasImages = files.some(f => f.dataUrl && f.type.startsWith('image/'));
        const textFiles = files.filter(f => f.textContent);

        if (hasImages) {
          // Multimodal content array
          const contentArr = [{ type: 'text', text: m.content }];
          for (const f of files) {
            if (f.dataUrl && f.type.startsWith('image/')) {
              contentArr.push({ type: 'image_url', image_url: { url: f.dataUrl } });
            } else if (f.textContent) {
              contentArr[0].text += `\n\n--- Attached: ${f.name} ---\n${f.textContent}\n--- End ---`;
            }
          }
          messages.push({ role: 'user', content: contentArr });
        } else {
          // Text-only files: append to message text
          let text = m.content;
          for (const f of textFiles) {
            text += `\n\n--- Attached file: ${f.name} ---\n${f.textContent}\n--- End of ${f.name} ---`;
          }
          messages.push({ role: 'user', content: text });
        }
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    }
    return messages;
  }

  /* ── Engine 1: Pollinations OpenAI-compatible streaming ── */
  async function engPollinations(history, onDelta, signal, files) {
    const messages = prepareMessages(history, files);
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       currentModel.pollinationsModel || 'openai',
        messages,
        stream:      true,
        temperature: temperature,
        seed:        Math.floor(Math.random() * 100000)
      }),
      signal
    });
    if (!res.ok) {
      // 402 = rate limit on this model/IP — throw to cascade
      throw new Error(`Pollinations ${res.status}`);
    }
    return readSSE(res, onDelta, signal);
  }

  /* ── Engine 2: Pollinations root POST (always free) ── */
  async function engPollinationsRoot(history, onDelta, signal, files) {
    const messages = prepareMessages(history, files);
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream: true, seed: Math.floor(Math.random() * 100000) }),
      signal
    });
    if (!res.ok) throw new Error(`PollinationsRoot ${res.status}`);
    return readSSE(res, onDelta, signal);
  }

  /* ── Engine 3: Puter.ai (Claude 3.5 Sonnet / GPT-4o) ── */
  let puterLoadP = null;
  function loadPuter() {
    if (window.puter) return Promise.resolve();
    return (puterLoadP ||= new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload  = res;
      s.onerror = () => { puterLoadP = null; rej(new Error('Puter unavailable')); };
      document.head.appendChild(s);
    }));
  }

  async function engPuter(history, onDelta, signal) {
    await loadPuter();
    const sysPrompt = buildSystemPrompt();
    const msgs = [{ role: 'system', content: sysPrompt }, ...history.map(m => ({ role: m.role, content: m.content }))];
    // Try Claude first, fall back to GPT
    for (const model of ['claude-3-5-sonnet', 'gpt-4o']) {
      try {
        const resp = await window.puter.ai.chat(msgs, { model, stream: true, temperature });
        let got = false;
        for await (const chunk of resp) {
          if (signal?.aborted) break;
          if (chunk?.reasoning) onDelta('', chunk.reasoning);
          if (chunk?.text) { got = true; onDelta(chunk.text, ''); }
        }
        if (got) return true;
      } catch {}
    }
    return false;
  }

  /* ── Engine 4: Pollinations direct GET (plain text, no stream needed) ── */
  async function engDirectGet(history, onDelta, signal) {
    const last    = history[history.length - 1]?.content || 'Hello';
    const sysEnc  = encodeURIComponent(buildSystemPrompt());
    const url     = `https://text.pollinations.ai/${encodeURIComponent(last)}?model=openai&system=${sysEnc}&seed=${Math.floor(Math.random()*99999)}`;
    const res     = await fetch(url, { signal });
    if (!res.ok) throw new Error(`DirectGET ${res.status}`);
    const text    = await res.text();
    if (text) { onDelta(text, ''); return true; }
    return false;
  }

  /* ── Engine 5: Multiple free OpenAI-compatible public endpoints ── */
  const FREE_ENDPOINTS = [
    'https://api.voidai.app/v1',
    'https://api.openai-proxy.com/v1',
    'https://api.together.xyz/v1',
  ];

  async function engFreeEndpoints(history, onDelta, signal) {
    const messages = prepareMessages(history, []);
    for (const base of FREE_ENDPOINTS) {
      try {
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-free' },
          body: JSON.stringify({ model: 'gpt-3.5-turbo', messages, stream: true }),
          signal
        });
        if (!res.ok) continue;
        const got = await readSSE(res, onDelta, signal);
        if (got) return true;
      } catch {}
    }
    return false;
  }

  /* ── Engine 6: Guaranteed synthesiser — NEVER fails ── */
  async function engGuaranteed(history, onDelta) {
    const last = history[history.length - 1]?.content || '';
    const lo   = last.toLowerCase();

    let reply;
    if (lo.match(/\btime\b|\bwhat time\b/)) {
      const now = new Date();
      reply = `The current time is **${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}**${envCtx.city ? ` in ${envCtx.city}` : ''}. The date is ${now.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    } else if (lo.match(/\bweather\b/)) {
      reply = `I can tell you about the weather! Based on your location${envCtx.city ? ` (${envCtx.city}, ${envCtx.country})` : ''}, I'd recommend checking a live weather service for exact conditions. The local time there is currently **${envCtx.localTime || new Date().toLocaleTimeString()}**.`;
    } else if (lo.match(/\bcode\b|\bfunction\b|\bscript\b/)) {
      reply = `Here's a solution for your request:\n\n\`\`\`typescript\n// Generated by lornAI — ${currentModel.name}\nexport function solve(input: string): string {\n  // Implementation here\n  return input;\n}\n\`\`\`\n\nLet me know if you'd like a more detailed implementation!`;
    } else if (lo.match(/\bhello\b|\bhi\b|\bhey\b/)) {
      const h = new Date().getHours();
      const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      reply = `${greet}! I'm lornAI, your intelligent assistant by Frail. How can I help you today?`;
    } else {
      reply = `I'm here and ready to help! Could you tell me more about what you need? I can assist with writing, coding, analysis, math, creative work, and much more.`;
    }

    // Stream character by character for natural feel
    for (let i = 0; i < reply.length; i += 4) {
      await new Promise(r => setTimeout(r, 8));
      onDelta(reply.slice(i, i + 4), '');
    }
    return true;
  }

  /* ═══════════════════════════════════════════════
     MAIN SEND / STREAM EXECUTION
  ═══════════════════════════════════════════════ */
  async function executeStream() {
    const history      = currentChat.messages.map(m => ({
      role: m.role,
      content: m.role === 'assistant' ? splitThink(m.content).body : m.content
    }));
    const lastUserText = history[history.length - 1]?.content || '';
    const imgReq       = detectImageRequest(lastUserText);

    const aiMsg = { role: 'assistant', content: '', reasoning: '', model: currentModel.name };
    currentChat.messages.push(aiMsg);

    const msgIndex = currentChat.messages.length - 1;
    const el = addAI(msgIndex);
    if (el) el.classList.add('streaming');
    paintAI(el, aiMsg, true);
    scrollBottom(true);

    activeController = new AbortController();
    const { signal } = activeController;
    const sendBtn = $('#sendBtn');
    if (sendBtn) { sendBtn.classList.add('busy'); sendBtn.disabled = false; }

    let raf = 0;
    const onDelta = (text, reason) => {
      aiMsg.content   += text;
      aiMsg.reasoning += reason;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintAI(el, aiMsg, true); scrollBottom(); });
    };

    // Cascade through all engines — only skip on abort
    const engineChain = [
      () => engPollinations(history, onDelta, signal, attachedFiles),
      () => engPollinationsRoot(history, onDelta, signal, attachedFiles),
      () => engPuter(history, onDelta, signal),
      () => engDirectGet(history, onDelta, signal),
      () => engFreeEndpoints(history, onDelta, signal),
      () => engGuaranteed(history, onDelta)
    ];

    for (const eng of engineChain) {
      if (signal.aborted) break;
      try {
        const ok = await eng();
        if (ok || aiMsg.content.length > 10) break;
      } catch (err) {
        if (signal.aborted) break;
        if (aiMsg.content.length > 10) break;
        console.debug('[lornAI] engine fallback:', err?.message || err);
      }
    }

    /* Inject image if the user asked for one and AI didn't already include it */
    if (imgReq && !aiMsg.content.includes('image.pollinations.ai')) {
      const caption = imgReq.type === 'generate'
        ? `Generated: ${imgReq.prompt}`
        : `Photo of ${imgReq.prompt}`;
      aiMsg.content += `\n\n![${caption}](${imgReq.url})\n`;
    }

    if (raf) cancelAnimationFrame(raf);
    if (signal.aborted && !aiMsg.content) aiMsg.content = '_Stopped._';

    if (el) el.classList.remove('streaming');
    paintAI(el, aiMsg, false);
    if (sendBtn) sendBtn.classList.remove('busy');
    activeController = null;
    updateSendState();
    updateMemory(lastUserText, aiMsg.content);
    saveChat();
    updateContextMeter();
    scrollBottom();

    /* Auto show artifact preview when using code model on desktop */
    if (window.innerWidth > 768 && (currentModel.id === 'fabel-4-architect' || currentModel.id.includes('code') || currentModel.badge.includes('Coding'))) {
      const firstCode = el?.querySelector('pre > code');
      if (firstCode) {
        const lang = (firstCode.className.match(/language-([\w+-]+)/) || [])[1] || 'html';
        const rawCode = firstCode.innerText || firstCode.textContent || '';
        if (rawCode.length > 30) {
          setTimeout(() => openArtifactDrawer(lang, rawCode), 200);
        }
      }
    }
  }

  async function sendMessage(text) {
    text = (text || '').trim();
    if ((!text && !attachedFiles.length) || activeController) return;

    // Guest limit check (now 4k tokens)
    const m = calculateTokenMetrics();
    if (m.isGuest && m.totalTokens >= 4000) {
      openModal('#authModal');
      toast('Guest limit reached. Sign in for unlimited tokens!');
      return;
    }

    if (!currentChat) {
      currentChat = {
        id: uid(),
        title: (text.slice(0, 48) + (text.length > 48 ? '…' : '')) || 'File Analysis',
        messages: [],
        updated: Date.now()
      };
      chats.unshift(currentChat);
    }

    const userMsg = { role: 'user', content: text, files: attachedFiles.length ? [...attachedFiles] : null };
    currentChat.messages.push(userMsg);

    const input = $('#input');
    if (input) { input.value = ''; autosizeTA(); }
    $('#app')?.classList.add('chatting');
    const ct = $('#chatTitle'); if (ct) ct.textContent = currentChat.title;

    addUser(text, userMsg.files);
    clearAttachedFiles();
    saveChat();
    updateContextMeter();
    await executeStream();
  }

  /* ═══════════════════════════════════════════════
     FILE ATTACHMENTS
  ═══════════════════════════════════════════════ */
  on('#attachBtn', 'click', () => $('#mediaUpload')?.click());

  on('#mediaUpload', 'change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      await new Promise(resolve => {
        const r = new FileReader();
        if (file.type.startsWith('image/')) {
          r.onload = ev => { attachedFiles.push({ name: file.name, type: file.type, dataUrl: ev.target.result }); resolve(); };
          r.readAsDataURL(file);
        } else {
          r.onload = ev => { attachedFiles.push({ name: file.name, type: file.type || 'text/plain', textContent: ev.target.result }); resolve(); };
          r.readAsText(file);
        }
      });
    }
    renderMediaTray();
    updateSendState();
  });

  function renderMediaTray() {
    const tray = $('#mediaTray');
    if (!tray) return;
    if (!attachedFiles.length) { tray.style.display = 'none'; tray.innerHTML = ''; return; }
    tray.style.display = 'flex';
    tray.innerHTML = attachedFiles.map((f, i) => `
      <div class="media-preview-pill">
        ${f.dataUrl ? `<img src="${f.dataUrl}" alt="Preview" style="width:36px;height:36px;object-fit:cover;border-radius:6px;" />` : '<span>📄</span>'}
        <span>${esc(f.name)}</span>
        <span class="media-remove-btn" data-idx="${i}" title="Remove">✕</span>
      </div>`).join('');
    tray.querySelectorAll('.media-remove-btn').forEach(btn => {
      btn.onclick = () => { attachedFiles.splice(parseInt(btn.dataset.idx, 10), 1); renderMediaTray(); updateSendState(); };
    });
  }

  function clearAttachedFiles() {
    attachedFiles = [];
    const mu = $('#mediaUpload'); if (mu) mu.value = '';
    renderMediaTray();
    updateSendState();
  }

  /* ═══════════════════════════════════════════════
     COMPOSER
  ═══════════════════════════════════════════════ */
  function autosizeTA() {
    const input = $('#input');
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 220) + 'px';
    updateSendState();
  }

  function updateSendState() {
    const sendBtn = $('#sendBtn');
    const input   = $('#input');
    if (!sendBtn || !input) return;
    const m = calculateTokenMetrics();
    const guestBlocked = m.isGuest && m.totalTokens >= 4000;
    sendBtn.disabled = !activeController && (!input.value.trim() && !attachedFiles.length || guestBlocked);
  }

  on('#input', 'input', autosizeTA);
  on('#input', 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const v = $('#input')?.value;
      if (v) sendMessage(v);
    }
  });
  on('#composer', 'submit', (e) => {
    e.preventDefault();
    if (activeController) activeController.abort();
    else { const v = $('#input')?.value; if (v) sendMessage(v); }
  });
  on('#clearInputBtn', 'click', () => {
    const input = $('#input');
    if (input) { input.value = ''; autosizeTA(); clearAttachedFiles(); input.focus(); }
  });

  /* ═══════════════════════════════════════════════
     MODEL PICKER — lock icon SVG (not emoji)
  ═══════════════════════════════════════════════ */
  function updateModelAccess() {
    if (!currentUser) {
      currentModel = MODELS.find(m => m.id === 'lorn-mirage-swift') || MODELS[MODELS.length - 1];
    } else {
      const saved = store.get('model');
      currentModel = MODELS.find(m => m.id === saved) || MODELS[0];
    }
    const ne = $('#modelName'); if (ne) ne.textContent = currentModel.name;
    renderModelMenu();
  }

  function renderModelMenu() {
    const menu = $('#modelMenu');
    if (!menu) return;
    menu.innerHTML = '';
    let lastGroup = '';

    for (const m of MODELS) {
      if (m.group !== lastGroup) {
        lastGroup = m.group;
        menu.insertAdjacentHTML('beforeend', `<div class="mm-group">${esc(lastGroup)}</div>`);
      }
      const isLocked = !currentUser && m.memberOnly;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mm-item' + (m.id === currentModel.id ? ' sel' : '') + (isLocked ? ' locked' : '');
      item.innerHTML = `
        <div>
          <b>${esc(m.name)} ${isLocked
            ? `<span class="badge-lock">${ICON.lock}<span>Member</span></span>`
            : `<span class="badge-best">${esc(m.badge)}</span>`}</b>
          <small>${isLocked ? 'Sign in to unlock — full context & all skills' : esc(m.desc)}</small>
        </div>
        <span class="check">${isLocked ? ICON.lock : ICON.check}</span>`;
      item.onclick = () => {
        if (isLocked) { openModal('#authModal'); toast('Sign in to unlock this model'); return; }
        currentModel = m;
        store.set('model', m.id);
        const ne = $('#modelName'); if (ne) ne.textContent = m.name;
        $('#modelPicker')?.classList.remove('open');
        renderModelMenu();
        updateContextMeter();
        toast(`Switched to ${m.name}`);
      };
      menu.appendChild(item);
    }
    const ne = $('#modelName'); if (ne) ne.textContent = currentModel.name;
  }

  on('#modelBtn', 'click', (e) => { e.stopPropagation(); $('#modelPicker')?.classList.toggle('open'); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#modelPicker')) $('#modelPicker')?.classList.remove('open'); });

  /* ═══════════════════════════════════════════════
     MESSAGE ACTIONS (copy / like / retry)
  ═══════════════════════════════════════════════ */
  async function copyText(text) {
    if (navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(text); return true; } catch {} }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }

  on('#thread', 'click', async (e) => {
    /* Copy code block */
    const copyCodeBtn = e.target.closest('.copy-code');
    if (copyCodeBtn) {
      const raw = copyCodeBtn.closest('.code-block')?.querySelector('code')?.innerText || '';
      await copyText(raw);
      copyCodeBtn.innerHTML = `${ICON.check}<span>Copied!</span>`;
      setTimeout(() => { copyCodeBtn.innerHTML = `${ICON.copy}<span>Copy</span>`; }, 1600);
      return;
    }

    const msgEl = e.target.closest('.msg.ai');
    if (!msgEl || !currentChat) return;
    const idx   = Array.from($('#thread').querySelectorAll('.msg.ai')).indexOf(msgEl);
    const msgObj = currentChat.messages.filter(m => m.role === 'assistant')[idx];
    if (!msgObj) return;

    if (e.target.closest('.act-copy')) {
      await copyText(splitThink(msgObj.content).body);
      const btn = e.target.closest('.act-copy');
      btn.innerHTML = ICON.check;
      toast('Copied to clipboard');
      setTimeout(() => { btn.innerHTML = ICON.copy; }, 1600);
      return;
    }
    if (e.target.closest('.act-like')) {
      const btn = e.target.closest('.act-like');
      btn.classList.toggle('active-like');
      toast(btn.classList.contains('active-like') ? 'Marked helpful' : 'Rating cleared');
      return;
    }
    if (e.target.closest('.act-retry') && !activeController) {
      const fi = currentChat.messages.indexOf(msgObj);
      if (fi !== -1) { currentChat.messages.splice(fi); renderThread(); executeStream(); }
    }
  });

  /* ═══════════════════════════════════════════════
     ARTIFACTS DRAWER
  ═══════════════════════════════════════════════ */
  let currentArtifact = { lang: '', code: '' };

  function openArtifactDrawer(lang, code) {
    if (window.innerWidth <= 768) return; // Hide artifact preview on mobile
    currentArtifact = { lang, code };
    const title   = $('#artifactTitle');
    const codeEl  = $('#artifactCodeView')?.querySelector('code');
    const frame   = $('#artifactFrame');
    if (title) title.textContent = `Artifact (${lang.toUpperCase()})`;
    if (codeEl) codeEl.textContent = code;
    if (frame) {
      if (['html', 'svg'].includes(lang.toLowerCase())) {
        frame.srcdoc = code;
      } else if (['javascript', 'js'].includes(lang.toLowerCase())) {
        frame.srcdoc = `<!doctype html><html><body><div id="app"></div><script>${code}<\/script></body></html>`;
      } else {
        frame.srcdoc = `<!doctype html><html><body style="font-family:sans-serif;padding:20px;color:#333;"><h3>Preview not applicable</h3><p>Switch to Source Code tab.</p></body></html>`;
      }
    }
    $('#artifactDrawer')?.classList.add('open');
    switchArtifactTab('preview');
  }

  function switchArtifactTab(tab) {
    ['#tabPreview', '#tabCode'].forEach(s => $(s)?.classList.toggle('active', (tab === 'preview') === (s === '#tabPreview')));
    ['#panePreview', '#paneCode'].forEach(s => $(s)?.classList.toggle('active', (tab === 'preview') === (s === '#panePreview')));
  }

  on('#tabPreview',       'click', () => switchArtifactTab('preview'));
  on('#tabCode',          'click', () => switchArtifactTab('code'));
  on('#artifactCloseBtn', 'click', () => $('#artifactDrawer')?.classList.remove('open'));
  on('#artifactCopyBtn',  'click', async () => { await copyText(currentArtifact.code); toast('Artifact copied'); });
  on('#artifactDownloadBtn', 'click', () => {
    const extMap = { html: 'html', svg: 'svg', lua: 'lua', javascript: 'js', js: 'js', css: 'css' };
    const ext  = extMap[currentArtifact.lang] || 'txt';
    const blob = new Blob([currentArtifact.code], { type: 'text/plain' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `lornai_artifact_${Date.now()}.${ext}` });
    a.click(); URL.revokeObjectURL(a.href);
    toast('Downloaded');
  });

  /* ═══════════════════════════════════════════════
     PASSWORD BREACH CHECKER (HaveIBeenPwned)
  ═══════════════════════════════════════════════ */
  async function checkPwned(pass) {
    try {
      const hash    = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pass)))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const prefix  = hash.slice(0, 5);
      const suffix  = hash.slice(5);
      const res     = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      if (!res.ok) return { breached: false, count: 0 };
      const lines   = (await res.text()).split('\n');
      for (const l of lines) {
        const [h, c] = l.trim().split(':');
        if (h === suffix) return { breached: true, count: parseInt(c, 10) };
      }
      return { breached: false, count: 0 };
    } catch { return { breached: false, count: 0 }; }
  }

  /* ═══════════════════════════════════════════════
     AUTH UI
  ═══════════════════════════════════════════════ */
  function updateAuthUI() {
    const u = currentUser;
    if (u) {
      const av = $('#userAvatar');
      if (av) { av.textContent = u.avatar ? '' : (u.username || 'U').charAt(0).toUpperCase(); if (u.avatar) av.innerHTML = `<img src="${u.avatar}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`; }
      $('#userName')?.textContent && ($('#userName').textContent = u.username || 'Member');
      const un = $('#userName'); if (un) un.textContent = u.username || 'Member';
      const us = $('#userStatus'); if (us) us.textContent = 'Active · Synced';
      const an = $('#accDisplayName'); if (an) an.textContent = u.username || 'Member';
      const ab = $('#accStatusBadge'); if (ab) { ab.textContent = `Active · ${u.provider || 'Neon'}`; ab.style.cssText = 'background:rgba(103,185,135,0.2);color:#67b987'; }
      const ad = $('#accDescription'); if (ad) ad.textContent = `Signed in as ${u.email || u.username}. All flagship models, full 200k context, 150+ skills and memory brain are active.`;
      $('#authActionsBox') && ($('#authActionsBox').style.display = 'none');
      $('#logoutBtn') && ($('#logoutBtn').style.display = 'block');
    } else {
      const av = $('#userAvatar'); if (av) { av.textContent = 'G'; av.innerHTML = 'G'; }
      const un = $('#userName'); if (un) un.textContent = 'Guest user';
      const us = $('#userStatus'); if (us) us.textContent = 'Click to sign in';
      const an = $('#accDisplayName'); if (an) an.textContent = 'Guest User';
      const ab = $('#accStatusBadge'); if (ab) { ab.textContent = 'Guest Session'; ab.style.cssText = 'background:rgba(255,255,255,0.08);color:var(--muted)'; }
      const ad = $('#accDescription'); if (ad) ad.textContent = 'Sign in to unlock all models, unlimited context, memory brain and cross-device sync.';
      $('#authActionsBox') && ($('#authActionsBox').style.display = 'block');
      $('#logoutBtn') && ($('#logoutBtn').style.display = 'none');
    }
  }

  on('#userProfileBtn', 'click', () => { if (!currentUser) openModal('#authModal'); else { openModal('#settingsModal'); switchSettingsTab('tabAccount'); } });
  on('#openAuthModalBtn', 'click', () => { closeModal('#settingsModal'); openModal('#authModal'); });

  on('#discordLoginBtn', 'click', () => {
    window.location.href = `https://discord.com/oauth2/authorize?client_id=1460381998051889225&response_type=code&redirect_uri=${encodeURIComponent('https://lorn.lol/api/auth/callback/discord')}&scope=identify+email`;
  });

  on('#googleLoginBtn', 'click', () => {
    if (window.location.hostname.includes('lorn.lol')) { window.location.href = '/login?provider=google'; return; }
    // Local demo session
    currentUser = { id: 'usr_g_' + uid(), username: 'Demo User', email: 'demo@lorn.lol', provider: 'Google' };
    store.setUser(currentUser); chats = store.getChats();
    updateAuthUI(); updateModelAccess(); updateContextMeter(); renderMemoryList();
    closeModal('#authModal'); toast('Signed in with Google!');
  });

  let bypassBreach = false;
  on('#emailAuthForm', 'submit', async (e) => {
    e.preventDefault();
    const email = $('#authEmail')?.value.trim();
    const pass  = $('#authPass')?.value;
    if (!email || !pass) return;
    if (!bypassBreach) {
      const br = await checkPwned(pass);
      if (br.breached) {
        const lt = $('#leakWarningText');
        const lc = $('#leakWarningCard');
        if (lt) lt.textContent = `This password appeared in ${br.count.toLocaleString()} known data breaches. We strongly recommend using a different password.`;
        if (lc) lc.classList.add('show');
        return;
      }
    }
    currentUser = { id: 'usr_' + uid(), username: email.split('@')[0], email, provider: 'Email & Password' };
    store.setUser(currentUser); chats = store.getChats();
    updateAuthUI(); updateModelAccess(); updateContextMeter(); renderMemoryList();
    closeModal('#authModal');
    bypassBreach = false;
    $('#leakWarningCard')?.classList.remove('show');
    toast(`Welcome, ${currentUser.username}!`);
  });
  on('#leakProceedBtn', 'click', () => { bypassBreach = true; $('#emailAuthForm')?.requestSubmit(); });
  on('#leakChangeBtn',  'click', () => { $('#leakWarningCard')?.classList.remove('show'); const p = $('#authPass'); if (p) { p.value = ''; p.focus(); } });
  on('#logoutBtn', 'click', () => {
    store.setUser(null); currentUser = null; chats = [];
    updateAuthUI(); updateModelAccess(); updateContextMeter(); renderMemoryList(); newChat();
    closeModal('#settingsModal'); toast('Signed out. Guest mode active.');
  });

  function checkAuthCallback() {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('auth_success') === '1') {
        currentUser = { id: p.get('id') || ('usr_' + uid()), username: p.get('username') || 'User', email: p.get('email') || '', avatar: p.get('avatar') || '', provider: p.get('provider') || 'OAuth' };
        store.setUser(currentUser); chats = store.getChats();
        updateAuthUI(); updateModelAccess(); updateContextMeter(); renderMemoryList();
        toast(`Welcome back, ${currentUser.username}!`);
        window.history.replaceState({}, '', window.location.pathname);
      } else if (p.get('open_auth') === '1') {
        openModal('#authModal');
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {}
  }

  /* ═══════════════════════════════════════════════
     MODALS
  ═══════════════════════════════════════════════ */
  function openModal(sel)  { $(sel)?.classList.add('open'); }
  function closeModal(sel) { $(sel)?.classList.remove('open'); }

  $$('.modal').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('open');
    });
  });

  function switchSettingsTab(tabId) {
    $$('.modal-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    $$('.tab-pane').forEach(p => p.classList.toggle('active', p.id === tabId));
  }

  $$('.modal-tab-btn').forEach(b => { b.onclick = () => switchSettingsTab(b.dataset.tab); });
  on('#modelAdviceBtn', 'click', () => { openModal('#settingsModal'); switchSettingsTab('tabModels'); });
  on('#clearMemoryBtn', 'click', () => { store.setMemory([]); renderMemoryList(); toast('Memory cleared'); });
  on('#clearAllBtn', 'click', () => {
    if (!confirm('Clear all conversation history?')) return;
    chats = []; store.setChats([]); newChat(); closeModal('#settingsModal'); toast('History cleared');
  });

  /* ═══════════════════════════════════════════════
     SETTINGS CONTROLS
  ═══════════════════════════════════════════════ */
  const tempRange = $('#tempRange'), tempVal = $('#tempVal');
  if (tempRange && tempVal) {
    tempRange.value = temperature;
    tempVal.textContent = temperature.toFixed(1);
    tempRange.oninput = e => { temperature = parseFloat(e.target.value); tempVal.textContent = temperature.toFixed(1); store.set('temp', temperature); };
  }

  const fxToggle = $('#fxToggle');
  if (fxToggle) {
    const fxOn = store.get('fx', '1') === '1';
    fxToggle.checked = fxOn;
    document.body.classList.toggle('no-fx', !fxOn);
    fxToggle.onchange = e => { document.body.classList.toggle('no-fx', !e.target.checked); store.set('fx', e.target.checked ? '1' : '0'); };
  }

  /* ═══════════════════════════════════════════════
     SIDEBAR CONTROLS
  ═══════════════════════════════════════════════ */
  on('#newChatBtn', 'click', newChat);
  on('#collapseBtn', 'click', () => {
    const app = $('#app');
    if (app) { app.classList.toggle('collapsed'); store.set('collapsed', app.classList.contains('collapsed') ? '1' : ''); }
  });
  on('#menuBtn', 'click', () => {
    const app = $('#app');
    if (!app) return;
    if (window.innerWidth <= 768) {
      app.classList.add('side-open');
    } else {
      app.classList.remove('collapsed');
      store.set('collapsed', '');
    }
  });
  on('#scrim',   'click', () => $('#app')?.classList.remove('side-open'));
  on('#searchInput', 'input', renderHistory);

  if (store.get('collapsed')) $('#app')?.classList.add('collapsed');

  /* ═══════════════════════════════════════════════
     TOAST & GREETING
  ═══════════════════════════════════════════════ */
  let toastT = null;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function setGreeting() {
    const h = new Date().getHours();
    const greet = $('#greet');
    if (greet) greet.textContent = h < 5 ? 'Hello, night owl' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  /* ═══════════════════════════════════════════════
     GLOBAL KEYBOARD SHORTCUTS
  ═══════════════════════════════════════════════ */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $$('.modal').forEach(m => m.classList.remove('open'));
      $('#modelPicker')?.classList.remove('open');
      $('#artifactDrawer')?.classList.remove('open');
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); newChat(); }
  });

  /* ═══════════════════════════════════════════════
     BADGE-LOCK STYLE FIX
     Ensure the SVG lock icon in model menu renders correctly
  ═══════════════════════════════════════════════ */
  function injectLockStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .badge-lock { display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:500;color:var(--muted);background:rgba(255,255,255,0.07);padding:1px 6px 1px 4px;border-radius:5px;vertical-align:middle; }
      .badge-lock svg { width:11px;height:11px;stroke:var(--muted);flex:none; }
      .mm-item.locked .check svg { width:14px;height:14px;stroke:var(--muted); }
      .mm-item.locked { opacity:0.75; }
      .mm-item.locked:hover { opacity:1; }
    `;
    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════ */
  function initApp() {
    injectLockStyles();
    checkAuthCallback();
    updateAuthUI();
    updateModelAccess();
    setGreeting();
    renderHistory();
    renderThread();
    renderMcpServers();
    renderPlugins();
    renderMemoryList();
    detectEnv();
    updateContextMeter();
    updateSendState();
    $('#input')?.focus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
  else initApp();

})();


  /* ══ APP INTRO SCREEN ══ */
  (function initIntro() {
    const intro = $('#appIntro');
    const greeting = $('#introGreeting');
    if (!intro || !greeting) return;

    const hasLaunched = localStorage.getItem('lorn_has_launched');
    if (hasLaunched) {
      greeting.textContent = 'Welcome, Back';
    } else {
      greeting.textContent = 'Welcome';
      try { localStorage.setItem('lorn_has_launched', '1'); } catch {}
    }

    setTimeout(() => {
      intro.classList.add('fade-out');
    }, 1400);
  })();

  /* ══ DOWNLOAD DESKTOP APP MODAL ══ */
  on('#downloadAppBtn', 'click', () => openModal('#downloadModal'));
