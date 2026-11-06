/**
 * lornAI — Intelligent Chat Platform
 * Default Model: Lorn DTS 5.5
 * iOS Glassmorphism, Fabel & Lorn DTS Engines, Multimodal Vision & Client Defense.
 */

(function () {
  'use strict';

  // ---------------- DOM Helpers ----------------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const on = (target, event, handler) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (el) el.addEventListener(event, handler);
  };

  // ---------------- Model Registry ----------------
  // Default is Lorn DTS 5.5 (Flagship Model)
  const MODELS = [
    {
      id: 'lorn-dts-5-5',
      name: 'Lorn DTS 5.5',
      badge: 'Flagship 5.5',
      desc: 'Most capable foundation model, deep reasoning & massive context',
      group: 'Lorn DTS Series',
      pollinations: 'openai-large',
      puter: 'claude-opus-5-5',
      systemRole: 'You are Lorn DTS 5.5, the flagship foundation omni model of lornAI. You possess extensive global knowledge, supreme reasoning clarity, and multimodal parsing capabilities.'
    },
    {
      id: 'fabel-code',
      name: 'Fabel Code',
      badge: 'Best for Coding',
      desc: 'Flagship coding, architecture & zero-defect synthesis',
      group: 'Fabel Series',
      pollinations: 'openai-large',
      puter: 'claude-3-5-sonnet',
      systemRole: 'You are Fabel Code, the premier AI coding intelligence in lornAI. You write bug-free, production-grade, elegantly documented code across Python, JavaScript, TypeScript, Lua, Rust, Go, C++, HTML/CSS and all modern frameworks. You deliver complete, working solutions with zero placeholders.'
    },
    {
      id: 'fabel-pro',
      name: 'Fabel Pro',
      badge: 'Deep Logic',
      desc: 'State-of-the-art analytical reasoning & complex logic',
      group: 'Fabel Series',
      pollinations: 'openai-large',
      puter: 'claude-opus-5-5',
      systemRole: 'You are Fabel Pro, an elite reasoning and scientific intelligence in lornAI. You excel at mathematical deduction, formal logic, multi-stage problem solving, and analytical research.'
    },
    {
      id: 'fabel-swift',
      name: 'Fabel Swift',
      badge: 'Instant Speed',
      desc: 'Lightning-fast conversational intelligence & creative writing',
      group: 'Fabel Series',
      pollinations: 'openai',
      puter: 'claude-haiku-4-5',
      systemRole: 'You are Fabel Swift, an ultra-fast, snappy, and creative conversational assistant in lornAI. You reply with warmth, wit, and high velocity.'
    },
    {
      id: 'lorn-dts-5',
      name: 'lorn dts 5.0',
      badge: 'Omni Foundation',
      desc: 'Foundation reasoning model & deep synthesis',
      group: 'Lorn DTS Series',
      pollinations: 'openai-large',
      puter: 'claude-3-5-sonnet',
      systemRole: 'You are lorn dts 5.0, a premier foundation omni model in lornAI.'
    },
    {
      id: 'lorn-dts-4.5',
      name: 'lorn dts 4.5',
      badge: 'Balanced Daily',
      desc: 'Smart, balanced, and nuanced for all daily tasks',
      group: 'Lorn DTS Series',
      pollinations: 'openai',
      puter: 'claude-sonnet-4-6',
      systemRole: 'You are lorn dts 4.5, a balanced and highly reliable AI assistant in lornAI.'
    },
    {
      id: 'lorn-dts-3.5',
      name: 'lorn dts 3.5',
      badge: 'Thorough Writer',
      desc: 'Deep essays, articulate explanations & summaries',
      group: 'Lorn DTS Series',
      pollinations: 'mistral',
      puter: 'claude-sonnet-4-5',
      systemRole: 'You are lorn dts 3.5, a thorough writer and researcher in lornAI.'
    },
    {
      id: 'lorn-light-4.5',
      name: 'lorn light 4.5',
      badge: 'High Speed',
      desc: 'High speed with sharp precision for quick answers',
      group: 'Lorn Light',
      pollinations: 'openai-fast',
      puter: 'claude-haiku-5-5',
      systemRole: 'You are lorn light 4.5, a nimble and quick AI model in lornAI.'
    },
    {
      id: 'lorn-light-2.5',
      name: 'lorn light 2.5',
      badge: 'Instant Micro',
      desc: 'Featherweight snappy model for instant feedback',
      group: 'Lorn Light',
      pollinations: 'openai-fast',
      puter: 'openai/gpt-5.4-nano',
      systemRole: 'You are lorn light 2.5, an instant lightweight model in lornAI.'
    }
  ];

  // ---------------- SVG Icons ----------------
  const ICON = {
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
    retry: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M7 10v11M2 10h5v11H2zM7 10l4-8a3 3 0 0 1 3 3v4h6a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.6 21H7"/></svg>',
    preview: '<svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'
  };

  // ---------------- State & Safe Storage ----------------
  const store = {
    getUser() {
      try { return JSON.parse(localStorage.getItem('lorn_user') || 'null'); } catch { return null; }
    },
    setUser(u) {
      try {
        if (u) localStorage.setItem('lorn_user', JSON.stringify(u));
        else localStorage.removeItem('lorn_user');
      } catch {}
    },
    getChats() {
      const u = store.getUser();
      if (!u) return window._guestChats || [];
      try { return JSON.parse(localStorage.getItem('lorn_chats_' + u.id) || '[]'); } catch { return []; }
    },
    setChats(v) {
      const u = store.getUser();
      if (!u) {
        window._guestChats = v.slice(0, 100);
        return;
      }
      try { localStorage.setItem('lorn_chats_' + u.id, JSON.stringify(v.slice(0, 200))); } catch {}
    },
    getMemory() {
      try { return JSON.parse(localStorage.getItem('lorn_memory') || '[]'); } catch { return []; }
    },
    setMemory(m) {
      try { localStorage.setItem('lorn_memory', JSON.stringify(m.slice(0, 50))); } catch {}
    },
    getMcpServers() {
      try { return JSON.parse(localStorage.getItem('lorn_mcp_servers') || '[]'); } catch { return []; }
    },
    setMcpServers(s) {
      try { localStorage.setItem('lorn_mcp_servers', JSON.stringify(s)); } catch {}
    },
    get(k, d) {
      try {
        const v = localStorage.getItem('lorn_' + k);
        return v == null ? d : v;
      } catch { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('lorn_' + k, v); } catch {}
    }
  };

  let currentUser = store.getUser();
  let chats = store.getChats();
  let currentChat = null;

  // Enforce Lorn DTS 5.5 as default model
  let savedModelId = store.get('model');
  let currentModel = MODELS.find((m) => m.id === savedModelId);
  if (!currentModel || currentModel.id === 'fabel-code') {
    currentModel = MODELS[0]; // Lorn DTS 5.5
    store.set('model', currentModel.id);
  }

  let temperature = parseFloat(store.get('temp', '0.6'));
  let attachedMedia = null;
  let activeController = null;
  let envContext = { timezone: '', city: '', country: '', localTime: '' };

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const escapeHtml = (s) => (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // Safe Markdown Setup
  try {
    if (window.marked && window.marked.setOptions) {
      window.marked.setOptions({ gfm: true, breaks: true });
    }
  } catch {}

  function splitThink(text) {
    const m = (text || '').match(/^\s*<think>([\s\S]*?)(<\/think>|$)/);
    if (!m) return { think: '', body: text || '' };
    return { think: m[1].trim(), body: m[2] ? text.slice(m.index + m[0].length) : '' };
  }

  function renderMarkdown(text) {
    let html = text || '';
    try {
      if (window.marked && window.marked.parse) html = window.marked.parse(html);
      if (window.DOMPurify && window.DOMPurify.sanitize) html = window.DOMPurify.sanitize(html);
    } catch {
      html = escapeHtml(text).replace(/\n/g, '<br/>');
    }

    const tpl = document.createElement('div');
    tpl.innerHTML = html;

    tpl.querySelectorAll('pre > code').forEach((code) => {
      const lang = (code.className.match(/language-([\w+-]+)/) || [])[1] || 'text';
      const pre = code.parentElement;
      const rawCode = code.innerText;

      const wrap = document.createElement('div');
      wrap.className = 'code-block';
      const isArtifactCandidate = ['html', 'svg', 'javascript', 'js', 'css', 'lua'].includes(lang.toLowerCase()) && rawCode.length > 40;

      wrap.innerHTML = `
        <div class="code-head">
          <span>${lang}</span>
          <div class="code-head-actions">
            ${isArtifactCandidate ? `<button type="button" class="run-artifact-btn">${ICON.preview}<span>Open Artifact</span></button>` : ''}
            <button type="button" class="copy-code">${ICON.copy}<span>Copy</span></button>
          </div>
        </div>
      `;
      pre.replaceWith(wrap);
      wrap.appendChild(pre);

      if (isArtifactCandidate) {
        const artBtn = wrap.querySelector('.run-artifact-btn');
        if (artBtn) {
          artBtn.onclick = (e) => {
            e.stopPropagation();
            openArtifactDrawer(lang, rawCode);
          };
        }
      }
    });

    return tpl;
  }

  function highlight(el) {
    if (!window.hljs || !el) return;
    el.querySelectorAll('pre code').forEach((c) => {
      try { window.hljs.highlightElement(c); } catch {}
    });
  }

  // ---------------- UI: Message Rendering ----------------
  function addUser(text, mediaObj) {
    const thread = $('#thread');
    if (!thread) return null;
    const el = document.createElement('div');
    el.className = 'msg user';
    let inner = '';
    if (mediaObj && mediaObj.dataUrl) {
      inner += `<img src="${mediaObj.dataUrl}" alt="Attachment" class="user-media" />`;
    }
    inner += `<div class="bubble">${escapeHtml(text)}</div>`;
    el.innerHTML = inner;
    thread.appendChild(el);
    return el;
  }

  function addAI() {
    const thread = $('#thread');
    if (!thread) return null;
    const el = document.createElement('div');
    el.className = 'msg ai';
    el.innerHTML = `
      <span class="mark ai-mark"></span>
      <div class="body">
        <div class="reason-slot"></div>
        <div class="content"></div>
        <div class="actions">
          <button type="button" data-act="copy" title="Copy">${ICON.copy}</button>
          <button type="button" data-act="like" title="Good response">${ICON.up}</button>
          <button type="button" data-act="retry" title="Retry">${ICON.retry}</button>
          <span class="meta"></span>
        </div>
      </div>
    `;
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
      d.querySelector('summary').innerHTML = streaming && !body ? '<span class="shim">Thinking…</span>' : 'Thinking process (click to view)';
      d.querySelector('div').textContent = reasoning;
    }

    const content = el.querySelector('.content');
    if (content) {
      if (!body && streaming) {
        content.innerHTML = reasoning ? '' : '<div class="thinking"><span class="shim">lornAI is thinking…</span></div>';
      } else {
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
        content.insertAdjacentHTML('beforeend', `<p class="err-text">⚠️ ${escapeHtml(msg.error)}</p>`);
      }
    }

    const meta = el.querySelector('.meta');
    if (meta) meta.textContent = '';
  }

  // ---------------- Auto-scroll lock ----------------
  let isNearBottom = true;
  const scroller = $('#scroller');
  if (scroller) {
    scroller.addEventListener('scroll', () => {
      isNearBottom = (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight) < 120;
    }, { passive: true });
  }

  function scrollThreadBottom(force = false) {
    if (!scroller) return;
    if (force || isNearBottom) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }

  function renderThread() {
    const thread = $('#thread');
    const appEl = $('#app');
    const chatTitle = $('#chatTitle');
    if (!thread) return;

    thread.innerHTML = '';
    const msgs = currentChat?.messages || [];
    if (appEl) appEl.classList.toggle('chatting', msgs.length > 0);
    if (chatTitle) chatTitle.textContent = currentChat?.title || 'New chat';

    for (const m of msgs) {
      if (m.role === 'user') {
        addUser(m.content, m.media);
      } else {
        paintAI(addAI(), m, false);
      }
    }
    requestAnimationFrame(() => scrollThreadBottom(true));
  }

  // ---------------- Sidebar History ----------------
  function renderHistory() {
    const searchInput = $('#searchInput');
    const h = $('#history');
    if (!h) return;
    const q = (searchInput?.value || '').toLowerCase().trim();
    h.innerHTML = '';

    chats.filter((c) => !q || (c.title || '').toLowerCase().includes(q)).forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'h-item' + (currentChat?.id === c.id ? ' active' : '');
      b.style.animationDelay = Math.min(i, 10) * 0.02 + 's';
      b.innerHTML = `<span></span><i class="del" title="Delete chat">${ICON.trash}</i>`;
      b.firstChild.textContent = c.title || 'Untitled chat';

      b.onclick = (e) => {
        if (e.target.closest('.del')) {
          chats = chats.filter((x) => x.id !== c.id);
          if (currentChat?.id === c.id) newChat();
          store.setChats(chats);
          renderHistory();
          return;
        }
        openChat(c.id);
      };
      h.appendChild(b);
    });
  }

  function openChat(id) {
    if (activeController) activeController.abort();
    currentChat = chats.find((c) => c.id === id) || null;
    renderThread();
    renderHistory();
    const appEl = $('#app');
    if (appEl) appEl.classList.remove('side-open');
  }

  function newChat() {
    if (activeController) activeController.abort();
    currentChat = null;
    renderThread();
    renderHistory();
    setGreeting();
    clearAttachedMedia();
    const appEl = $('#app');
    if (appEl) appEl.classList.remove('side-open');
    const inputEl = $('#input');
    if (inputEl) inputEl.focus();
  }

  function saveCurrentChat() {
    if (currentChat) {
      currentChat.updated = Date.now();
      chats = [currentChat, ...chats.filter((c) => c.id !== currentChat.id)];
      store.setChats(chats);
      renderHistory();
    }
  }

  // ---------------- IP & Location Detection ----------------
  async function detectEnvironmentContext() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const now = new Date();
      envContext.timezone = tz;
      envContext.localTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + now.toLocaleDateString() + ')';

      const res = await fetch('https://freeipapi.com/api/json').catch(() => null);
      if (res && res.ok) {
        const geo = await res.json();
        envContext.city = geo.cityName || '';
        envContext.country = geo.countryName || '';
      }
    } catch {}

    const label = $('#envContextLabel');
    if (label) {
      label.textContent = `${envContext.city ? envContext.city + ', ' : ''}${envContext.country || 'Global'} · ${envContext.localTime || 'Active'}`;
    }
  }

  // ---------------- Memory ----------------
  function updateMemoryFromConversation(userText, aiText) {
    const mems = store.getMemory();
    const matches = (userText || '').match(/\b(?:my name is|i am|i live in|i work as|i prefer|my project is|call me)\b\s+([^.!?\n]+)/i);
    if (matches && matches[1]) {
      const fact = matches[0].trim();
      if (!mems.includes(fact)) {
        mems.unshift(fact);
        store.setMemory(mems);
        renderMemoryList();
      }
    }
  }

  function renderMemoryList() {
    const box = $('#memoryList');
    if (!box) return;
    const mems = store.getMemory();
    if (mems.length === 0) {
      box.innerHTML = 'No memories stored yet. Converse with lornAI to start building memory.';
    } else {
      box.innerHTML = mems.map((m) => `<div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">• ${escapeHtml(m)}</div>`).join('');
    }
  }

  // ---------------- Multi-Engine Streaming ----------------
  async function readSSEStream(res, onDelta, signal) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedContent = false;

    while (true) {
      if (signal.aborted) {
        reader.cancel().catch(() => {});
        break;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return receivedContent;

        let parsed;
        try { parsed = JSON.parse(payload); } catch { continue; }
        if (parsed.error) throw new Error(parsed.error.message || 'Stream error');

        const delta = parsed.choices?.[0]?.delta || parsed.choices?.[0]?.message || {};
        const text = delta.content || '';
        const reasoning = delta.reasoning_content || delta.reasoning || '';

        if (text || reasoning) {
          receivedContent = receivedContent || !!text;
          onDelta(text, reasoning);
        }
      }
    }
    return receivedContent;
  }

  const engines = {
    async pollinations(msgs, onDelta, signal, mediaObj) {
      const sysPrompt = buildSystemPrompt();
      let formattedMsgs = [{ role: 'system', content: sysPrompt }];

      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (i === msgs.length - 1 && mediaObj && mediaObj.dataUrl) {
          formattedMsgs.push({
            role: m.role,
            content: [
              { type: 'text', text: m.content },
              { type: 'image_url', image_url: { url: mediaObj.dataUrl } }
            ]
          });
        } else {
          formattedMsgs.push({ role: m.role, content: m.content });
        }
      }

      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: currentModel.pollinations || 'openai',
          messages: formattedMsgs,
          stream: true,
          temperature
        }),
        signal
      });

      if (!res.ok) throw new Error('Pollinations HTTP ' + res.status);
      return { ok: await readSSEStream(res, onDelta, signal) };
    },

    async puter(msgs, onDelta, signal) {
      await loadPuterScript();
      const sysPrompt = buildSystemPrompt();
      const resp = await window.puter.ai.chat(
        [{ role: 'system', content: sysPrompt }, ...msgs],
        { model: currentModel.puter || 'claude-opus-5-5', stream: true, temperature }
      );

      let got = false;
      for await (const chunk of resp) {
        if (signal.aborted) break;
        if (chunk?.reasoning) onDelta('', chunk.reasoning);
        if (chunk?.text) {
          got = true;
          onDelta(chunk.text, '');
        }
      }
      return { ok: got };
    },

    async directFallback(msgs, onDelta, signal) {
      const last = msgs[msgs.length - 1]?.content || 'Hello';
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(last)}?model=openai&system=${encodeURIComponent(buildSystemPrompt())}`, { signal });
      if (!res.ok) throw new Error('Direct HTTP ' + res.status);
      const text = await res.text();
      onDelta(text, '');
      return { ok: true };
    }
  };

  let puterLoadingPromise = null;
  function loadPuterScript() {
    if (window.puter) return Promise.resolve();
    return (puterLoadingPromise ||= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload = resolve;
      s.onerror = () => { puterLoadingPromise = null; reject(new Error('Puter load failed')); };
      document.head.appendChild(s);
    }));
  }

  function buildSystemPrompt() {
    const mems = store.getMemory();
    const memoryStr = mems.length ? `\nUser Continuity & Facts: ${mems.join('; ')}` : '';
    const geoStr = envContext.country ? `\nUser Location: ${envContext.city ? envContext.city + ', ' : ''}${envContext.country}. Local Time: ${envContext.localTime}. Timezone: ${envContext.timezone}.` : '';

    return `${currentModel.systemRole}
You are operating within lornAI — a transcendent, beautiful AI chat system.
Autonomous Skills: 150+ master software, design, algorithmic, and mathematical capabilities are permanently active in your brain.${geoStr}${memoryStr}
Always answer questions about local time, weather, or real-world events utilizing the environmental context provided above.
Format all responses with clean GitHub-flavored Markdown. When writing complete scripts or web applications, write exhaustive, flawless code.`;
  }

  // ---------------- Send Execution ----------------
  async function executeStream() {
    const history = currentChat.messages.map((m) => ({
      role: m.role,
      content: m.role === 'assistant' ? splitThink(m.content).body : m.content
    }));

    const aiMsg = { role: 'assistant', content: '', reasoning: '', model: currentModel.name };
    currentChat.messages.push(aiMsg);

    const el = addAI();
    if (el) el.classList.add('streaming');
    paintAI(el, aiMsg, true);
    scrollThreadBottom(true);

    activeController = new AbortController();
    const { signal } = activeController;
    const sendBtn = $('#sendBtn');
    if (sendBtn) {
      sendBtn.classList.add('busy');
      sendBtn.disabled = false;
    }

    let animFrame = 0;
    const onDelta = (text, reason) => {
      aiMsg.content += text;
      aiMsg.reasoning += reason;
      if (!animFrame) {
        animFrame = requestAnimationFrame(() => {
          animFrame = 0;
          paintAI(el, aiMsg, true);
          scrollThreadBottom();
        });
      }
    };

    let finished = false;
    const engineChain = ['pollinations', 'puter', 'directFallback'];

    for (const eng of engineChain) {
      if (signal.aborted) break;
      try {
        const res = await engines[eng](history, onDelta, signal, attachedMedia);
        if (res.ok || aiMsg.content) {
          finished = true;
          break;
        }
      } catch (err) {
        if (signal.aborted) break;
        if (aiMsg.content) { finished = true; break; }
        console.warn(`[lornAI] Engine ${eng} failed, switching to fallback:`, err);
        aiMsg.reasoning = '';
      }
    }

    if (animFrame) cancelAnimationFrame(animFrame);
    if (!finished && !signal.aborted) {
      aiMsg.error = 'All engines are currently busy. Please try sending your request again.';
    }
    if (signal.aborted && !aiMsg.content) {
      aiMsg.content = '_Message stopped._';
    }

    if (el) el.classList.remove('streaming');
    paintAI(el, aiMsg, false);
    if (sendBtn) sendBtn.classList.remove('busy');
    activeController = null;
    updateSendButtonState();

    updateMemoryFromConversation(history[history.length - 1]?.content || '', aiMsg.content);
    saveCurrentChat();
    scrollThreadBottom();
  }

  async function sendMessage(text) {
    text = (text || '').trim();
    if ((!text && !attachedMedia) || activeController) return;

    if (!currentChat) {
      currentChat = {
        id: uid(),
        title: text.slice(0, 48) + (text.length > 48 ? '…' : '') || 'Image Query',
        messages: [],
        updated: Date.now()
      };
      chats.unshift(currentChat);
    }

    const userMsg = { role: 'user', content: text, media: attachedMedia ? { ...attachedMedia } : null };
    currentChat.messages.push(userMsg);

    const input = $('#input');
    if (input) {
      input.value = '';
      autosizeTextarea();
    }
    const appEl = $('#app');
    if (appEl) appEl.classList.add('chatting');
    const chatTitle = $('#chatTitle');
    if (chatTitle) chatTitle.textContent = currentChat.title;

    addUser(text, userMsg.media);
    clearAttachedMedia();
    saveCurrentChat();

    await executeStream();
  }

  // ---------------- Media Upload & Vision ----------------
  const mediaUpload = $('#mediaUpload');
  if (mediaUpload) {
    mediaUpload.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        attachedMedia = {
          name: file.name,
          type: file.type,
          dataUrl: ev.target.result
        };
        renderMediaTray();
        updateSendButtonState();
      };
      reader.readAsDataURL(file);
    });
  }

  on('#attachBtn', 'click', () => {
    if (mediaUpload) mediaUpload.click();
  });

  function renderMediaTray() {
    const mediaTray = $('#mediaTray');
    if (!mediaTray) return;
    if (!attachedMedia) {
      mediaTray.style.display = 'none';
      mediaTray.innerHTML = '';
      return;
    }
    mediaTray.style.display = 'flex';
    mediaTray.innerHTML = `
      <div class="media-preview-pill">
        <img src="${attachedMedia.dataUrl}" alt="Preview" />
        <span>${escapeHtml(attachedMedia.name)}</span>
        <span class="media-remove-btn" id="removeMediaBtn" title="Remove attachment">✕</span>
      </div>
    `;
    const removeBtn = $('#removeMediaBtn');
    if (removeBtn) removeBtn.onclick = clearAttachedMedia;
  }

  function clearAttachedMedia() {
    attachedMedia = null;
    if (mediaUpload) mediaUpload.value = '';
    renderMediaTray();
    updateSendButtonState();
  }

  // ---------------- Composer Controls ----------------
  function autosizeTextarea() {
    const input = $('#input');
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 220) + 'px';
    updateSendButtonState();
  }

  function updateSendButtonState() {
    const sendBtn = $('#sendBtn');
    const input = $('#input');
    if (!sendBtn || !input) return;
    sendBtn.disabled = !activeController && !input.value.trim() && !attachedMedia;
  }

  on('#input', 'input', autosizeTextarea);
  on('#input', 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const input = $('#input');
      if (input) sendMessage(input.value);
    }
  });

  on('#composer', 'submit', (e) => {
    e.preventDefault();
    if (activeController) activeController.abort();
    else {
      const input = $('#input');
      if (input) sendMessage(input.value);
    }
  });

  on('#clearInputBtn', 'click', () => {
    const input = $('#input');
    if (input) {
      input.value = '';
      autosizeTextarea();
      clearAttachedMedia();
      input.focus();
    }
  });

  on('#suggestions', 'click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.p) sendMessage(b.dataset.p);
  });

  // ---------------- Model Picker in Composer ----------------
  function renderModelMenu() {
    const menu = $('#modelMenu');
    if (!menu) return;
    menu.innerHTML = '';
    let lastGroup = '';

    for (const m of MODELS) {
      if (m.group !== lastGroup) {
        lastGroup = m.group;
        menu.insertAdjacentHTML('beforeend', `<div class="mm-group">${lastGroup}</div>`);
      }

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mm-item' + (m.id === currentModel.id ? ' sel' : '');
      item.innerHTML = `
        <div>
          <b>${m.name} <span class="badge-best">${m.badge}</span></b>
          <small>${m.desc}</small>
        </div>
        <span class="check">${ICON.check}</span>
      `;

      item.onclick = () => {
        currentModel = m;
        store.set('model', m.id);
        const nameEl = $('#modelName');
        if (nameEl) nameEl.textContent = m.name;
        const picker = $('#modelPicker');
        if (picker) picker.classList.remove('open');
        renderModelMenu();
        toast(`Switched to ${m.name}`);
      };
      menu.appendChild(item);
    }
    const nameEl = $('#modelName');
    if (nameEl) nameEl.textContent = currentModel.name;
  }

  on('#modelBtn', 'click', (e) => {
    e.stopPropagation();
    const picker = $('#modelPicker');
    if (picker) picker.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#modelPicker')) {
      const picker = $('#modelPicker');
      if (picker) picker.classList.remove('open');
    }
  });

  // ---------------- Message Action Buttons ----------------
  on('#thread', 'click', async (e) => {
    const copyCodeBtn = e.target.closest('.copy-code');
    if (copyCodeBtn) {
      const codeBlock = copyCodeBtn.closest('.code-block');
      if (codeBlock) {
        const raw = codeBlock.querySelector('code')?.innerText || '';
        await navigator.clipboard.writeText(raw);
        copyCodeBtn.innerHTML = `${ICON.check}<span>Copied</span>`;
        setTimeout(() => { copyCodeBtn.innerHTML = `${ICON.copy}<span>Copy</span>`; }, 1500);
      }
      return;
    }

    const actBtn = e.target.closest('[data-act]');
    if (!actBtn || !currentChat) return;

    const thread = $('#thread');
    const msgs = [...thread.querySelectorAll('.msg')];
    const idx = msgs.indexOf(actBtn.closest('.msg'));
    const msgObj = currentChat.messages[idx];
    if (!msgObj) return;

    if (actBtn.dataset.act === 'copy') {
      await navigator.clipboard.writeText(splitThink(msgObj.content).body);
      actBtn.innerHTML = ICON.check;
      setTimeout(() => { actBtn.innerHTML = ICON.copy; }, 1400);
    } else if (actBtn.dataset.act === 'like') {
      actBtn.style.color = 'var(--accent)';
      toast('Response saved to favorites');
    } else if (actBtn.dataset.act === 'retry' && !activeController) {
      currentChat.messages.splice(idx);
      msgs.slice(idx).forEach((n) => n.remove());
      executeStream();
    }
  });

  // ---------------- Artifacts Drawer ----------------
  let currentArtifact = { lang: '', code: '' };

  function openArtifactDrawer(lang, code) {
    currentArtifact = { lang, code };
    const drawer = $('#artifactDrawer');
    const title = $('#artifactTitle');
    const codeView = $('#artifactCodeView');
    if (title) title.textContent = `Artifact (${lang.toUpperCase()})`;
    if (codeView) {
      const codeEl = codeView.querySelector('code');
      if (codeEl) codeEl.textContent = code;
    }

    const frame = $('#artifactFrame');
    if (frame) {
      if (['html', 'svg'].includes(lang.toLowerCase())) {
        frame.srcdoc = code;
      } else if (['javascript', 'js'].includes(lang.toLowerCase())) {
        frame.srcdoc = `<!doctype html><html><body><div id="app"></div><script>${code}<\/script></body></html>`;
      } else {
        frame.srcdoc = `<!doctype html><html><body style="font-family:sans-serif;padding:20px;color:#333;"><h3>Preview not applicable</h3><p>Switch to the Source Code tab.</p></body></html>`;
      }
    }

    if (drawer) drawer.classList.add('open');
    switchArtifactTab('preview');
  }

  function closeArtifactDrawer() {
    const drawer = $('#artifactDrawer');
    if (drawer) drawer.classList.remove('open');
  }

  function switchArtifactTab(tab) {
    const tabPreview = $('#tabPreview');
    const tabCode = $('#tabCode');
    const panePreview = $('#panePreview');
    const paneCode = $('#paneCode');

    if (tab === 'preview') {
      if (tabPreview) tabPreview.classList.add('active');
      if (tabCode) tabCode.classList.remove('active');
      if (panePreview) panePreview.classList.add('active');
      if (paneCode) paneCode.classList.remove('active');
    } else {
      if (tabCode) tabCode.classList.add('active');
      if (tabPreview) tabPreview.classList.remove('active');
      if (paneCode) paneCode.classList.add('active');
      if (panePreview) panePreview.classList.remove('active');
    }
  }

  on('#tabPreview', 'click', () => switchArtifactTab('preview'));
  on('#tabCode', 'click', () => switchArtifactTab('code'));
  on('#artifactCloseBtn', 'click', closeArtifactDrawer);

  on('#artifactCopyBtn', 'click', async () => {
    await navigator.clipboard.writeText(currentArtifact.code);
    toast('Artifact copied to clipboard');
  });

  on('#artifactDownloadBtn', 'click', () => {
    const blob = new Blob([currentArtifact.code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const ext = currentArtifact.lang === 'html' ? 'html' : currentArtifact.lang === 'svg' ? 'svg' : currentArtifact.lang === 'lua' ? 'lua' : 'js';
    a.download = `lornai_artifact_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Artifact downloaded');
  });

  // ---------------- Public Password Breach Checker ----------------
  async function checkPasswordPwned(password) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuf = await crypto.subtle.digest('SHA-1', data);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      const hashHex = hashArr.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

      const prefix = hashHex.slice(0, 5);
      const suffix = hashHex.slice(5);

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      if (!res.ok) return { breached: false, count: 0 };

      const body = await res.text();
      const lines = body.split('\n');
      for (const l of lines) {
        const [h, count] = l.trim().split(':');
        if (h === suffix) {
          return { breached: true, count: parseInt(count, 10) };
        }
      }
      return { breached: false, count: 0 };
    } catch {
      return { breached: false, count: 0 };
    }
  }

  // ---------------- Auth & Modal Handlers ----------------
  function updateAuthUI() {
    const user = currentUser;
    const avatar = $('#userAvatar');
    const name = $('#userName');
    const status = $('#userStatus');

    const accName = $('#accDisplayName');
    const accStatus = $('#accStatusBadge');
    const accDesc = $('#accDescription');
    const authBox = $('#authActionsBox');
    const logoutBtn = $('#logoutBtn');

    if (user) {
      if (avatar) {
        avatar.textContent = user.username ? user.username.charAt(0).toUpperCase() : 'U';
        if (user.avatar) avatar.innerHTML = `<img src="${user.avatar}" alt="Avatar" />`;
      }
      if (name) name.textContent = user.username || 'Logged In';
      if (status) status.textContent = 'Active · Synced';

      if (accName) accName.textContent = user.username;
      if (accStatus) {
        accStatus.textContent = 'Active · ' + (user.provider || 'Neon Account');
        accStatus.style.background = 'rgba(103, 185, 135, 0.2)';
        accStatus.style.color = '#67b987';
      }
      if (accDesc) {
        accDesc.textContent = `Signed in as ${user.email || user.username}. All conversations, skills, and memory are permanently synced.`;
      }

      if (authBox) authBox.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
      if (avatar) avatar.textContent = 'G';
      if (name) name.textContent = 'Guest user';
      if (status) status.textContent = 'Click to log in';

      if (accName) accName.textContent = 'Guest User';
      if (accStatus) {
        accStatus.textContent = 'Offline Guest';
        accStatus.style.background = 'rgba(255,255,255,0.08)';
        accStatus.style.color = 'var(--muted)';
      }
      if (accDesc) {
        accDesc.textContent = 'Tabs and conversation history are only permanently stored when you log in or register.';
      }

      if (authBox) authBox.style.display = 'block';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }

  // Bottom-left profile click opens Auth / Account
  on('#userProfileBtn', 'click', () => {
    if (!currentUser) {
      openModal('#authModal');
    } else {
      openModal('#settingsModal');
      switchSettingsTab('tabAccount');
    }
  });

  on('#openAuthModalBtn', 'click', () => {
    closeModal('#settingsModal');
    openModal('#authModal');
  });

  // Discord OAuth
  on('#discordLoginBtn', 'click', () => {
    const CLIENT_ID = '1460381998051889225';
    const REDIRECT_URI = encodeURIComponent('https://lorn.lol/api/auth/callback/discord');
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=identify+email`;
  });

  // Google OAuth via Neon
  on('#googleLoginBtn', 'click', () => {
    window.location.href = 'https://ep-royal-glade-zajwo96h.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth/google';
  });

  // Phone Auth via Neon
  on('#phoneLoginBtn', 'click', () => {
    window.location.href = 'https://ep-royal-glade-zajwo96h.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth/phone';
  });

  // Email Form with Breach Checking
  let bypassBreachWarning = false;
  on('#emailAuthForm', 'submit', async (e) => {
    e.preventDefault();
    const emailEl = $('#authEmail');
    const passEl = $('#authPass');
    if (!emailEl || !passEl) return;
    const email = emailEl.value.trim();
    const pass = passEl.value;

    if (!bypassBreachWarning) {
      const breachResult = await checkPasswordPwned(pass);
      if (breachResult.breached) {
        const text = $('#leakWarningText');
        const card = $('#leakWarningCard');
        if (text) text.textContent = `Security Warning: This password was found in ${breachResult.count.toLocaleString()} known public data breaches across the web. We strongly advise choosing a unique password.`;
        if (card) card.classList.add('show');
        return;
      }
    }

    currentUser = {
      id: 'usr_' + uid(),
      username: email.split('@')[0],
      email: email,
      provider: 'Email & Password'
    };
    store.setUser(currentUser);
    chats = store.getChats();
    updateAuthUI();
    closeModal('#authModal');
    bypassBreachWarning = false;
    const card = $('#leakWarningCard');
    if (card) card.classList.remove('show');
    toast(`Welcome to lornAI, ${currentUser.username}!`);
  });

  on('#leakProceedBtn', 'click', () => {
    bypassBreachWarning = true;
    const form = $('#emailAuthForm');
    if (form) form.requestSubmit();
  });

  on('#leakChangeBtn', 'click', () => {
    const card = $('#leakWarningCard');
    if (card) card.classList.remove('show');
    const pass = $('#authPass');
    if (pass) {
      pass.value = '';
      pass.focus();
    }
  });

  on('#logoutBtn', 'click', () => {
    store.setUser(null);
    currentUser = null;
    chats = [];
    updateAuthUI();
    newChat();
    closeModal('#settingsModal');
    toast('Signed out successfully');
  });

  function checkAuthCallback() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth_success') === '1') {
        currentUser = {
          id: params.get('id') || ('usr_' + uid()),
          username: params.get('username') || 'User',
          email: params.get('email') || '',
          avatar: params.get('avatar') || '',
          provider: params.get('provider') || 'OAuth'
        };
        store.setUser(currentUser);
        chats = store.getChats();
        updateAuthUI();
        toast(`Successfully authenticated via ${currentUser.provider}!`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {}
  }

  // ---------------- Modal Management ----------------
  function openModal(sel) {
    const m = $(sel);
    if (m) m.classList.add('open');
  }

  function closeModal(sel) {
    const m = $(sel);
    if (m) m.classList.remove('open');
  }

  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('[data-close]')) {
        m.classList.remove('open');
      }
    });
  });

  function switchSettingsTab(tabId) {
    $$('.modal-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
    $$('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === tabId));
  }

  $$('.modal-tab-btn').forEach((b) => {
    b.onclick = () => switchSettingsTab(b.dataset.tab);
  });

  on('#modelAdviceBtn', 'click', () => {
    openModal('#settingsModal');
    switchSettingsTab('tabModels');
  });

  // ---------------- MCP Server Manager ----------------
  function renderMcpServers() {
    const list = $('#mcpServerList');
    if (!list) return;
    const servers = store.getMcpServers();
    if (servers.length === 0) {
      list.innerHTML = `
        <div style="font-size: 12.5px; color: var(--dim); padding: 12px; text-align: center; border: 1px dashed var(--line); border-radius: 12px;">
          No MCP servers added yet. Add a server to grant lornAI external tooling capabilities.
        </div>
      `;
      return;
    }
    list.innerHTML = servers.map((s, i) => `
      <div class="advice-card" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <b>${escapeHtml(s.name)}</b>
          <small style="display: block; color: var(--dim);">${escapeHtml(s.endpoint)}</small>
        </div>
        <button type="button" class="icon-btn del-mcp" data-idx="${i}" title="Remove">${ICON.trash}</button>
      </div>
    `).join('');

    list.querySelectorAll('.del-mcp').forEach((btn) => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        servers.splice(idx, 1);
        store.setMcpServers(servers);
        renderMcpServers();
        toast('MCP server removed');
      };
    });
  }

  on('#addMcpServerBtn', 'click', () => {
    closeModal('#settingsModal');
    openModal('#mcpModal');
  });

  on('#addMcpForm', 'submit', (e) => {
    e.preventDefault();
    const nameEl = $('#mcpName');
    const endEl = $('#mcpEndpoint');
    const descEl = $('#mcpDesc');
    if (!nameEl || !endEl) return;
    const name = nameEl.value.trim();
    const endpoint = endEl.value.trim();
    const desc = descEl ? descEl.value.trim() : '';

    const servers = store.getMcpServers();
    servers.push({ name, endpoint, desc });
    store.setMcpServers(servers);

    const form = $('#addMcpForm');
    if (form) form.reset();
    closeModal('#mcpModal');
    openModal('#settingsModal');
    switchSettingsTab('tabMCP');
    renderMcpServers();
    toast(`Connected to ${name}`);
  });

  on('#clearMemoryBtn', 'click', () => {
    store.setMemory([]);
    renderMemoryList();
    toast('AI memory cleared');
  });

  on('#clearAllBtn', 'click', () => {
    if (!confirm('Are you sure you want to clear the current conversation history?')) return;
    chats = [];
    store.setChats([]);
    newChat();
    closeModal('#settingsModal');
    toast('Conversation history cleared');
  });

  // Creativity Slider & Ambient FX
  const tempRange = $('#tempRange');
  const tempVal = $('#tempVal');
  if (tempRange && tempVal) {
    tempRange.value = temperature;
    tempVal.textContent = temperature.toFixed(1);
    tempRange.oninput = (e) => {
      temperature = parseFloat(e.target.value);
      tempVal.textContent = temperature.toFixed(1);
      store.set('temp', temperature);
    };
  }

  const fxEnabled = store.get('fx', '1') === '1';
  const fxToggle = $('#fxToggle');
  if (fxToggle) {
    fxToggle.checked = fxEnabled;
    if (document.body) document.body.classList.toggle('no-fx', !fxEnabled);
    fxToggle.onchange = (e) => {
      if (document.body) document.body.classList.toggle('no-fx', !e.target.checked);
      store.set('fx', e.target.checked ? '1' : '0');
    };
  }

  // ---------------- Sidebar Controls ----------------
  on('#newChatBtn', 'click', newChat);
  on('#collapseBtn', 'click', () => {
    const appEl = $('#app');
    if (appEl) {
      appEl.classList.toggle('collapsed');
      store.set('collapsed', appEl.classList.contains('collapsed') ? '1' : '');
    }
  });

  on('#menuBtn', 'click', () => {
    const appEl = $('#app');
    if (appEl) appEl.classList.add('side-open');
  });

  on('#scrim', 'click', () => {
    const appEl = $('#app');
    if (appEl) appEl.classList.remove('side-open');
  });

  on('#searchInput', 'input', renderHistory);

  if (store.get('collapsed')) {
    const appEl = $('#app');
    if (appEl) appEl.classList.add('collapsed');
  }

  // ---------------- Toast & Greeting ----------------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  function setGreeting() {
    const h = new Date().getHours();
    const greet = $('#greet');
    if (greet) {
      greet.textContent = h < 5 ? 'Hello, night owl' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    }
  }

  // Global hotkeys
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal').forEach((m) => m.classList.remove('open'));
      const picker = $('#modelPicker');
      if (picker) picker.classList.remove('open');
      closeArtifactDrawer();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      newChat();
    }
  });

  // ---------------- Initialize Application ----------------
  function initApp() {
    checkAuthCallback();
    updateAuthUI();
    setGreeting();
    renderModelMenu();
    renderHistory();
    renderThread();
    renderMcpServers();
    renderMemoryList();
    detectEnvironmentContext();
    updateSendButtonState();

    const input = $('#input');
    if (input) input.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
