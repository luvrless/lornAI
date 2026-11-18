import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Composer from "./components/Composer.jsx";
import Message from "./components/Message.jsx";
import CodePanel from "./components/CodePanel.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import Logo from "./components/Logo.jsx";
import { IconChevron, IconPlus, IconSidebar, IconMenu, IconSettings } from "./components/Icons.jsx";
import { loadChats, loadSettings, saveChats, saveSettings, uid } from "./lib/storage.js";
import { streamChat, fetchConfig } from "./lib/api.js";
import { getModel } from "./lib/models.js";
import { extractCodeBlocks, canPreview, fileNameFor } from "./lib/preview.js";

const SUGGESTIONS = [
  { title: "Build a landing page", sub: "Responsive SaaS hero with animations", prompt: "Build a modern, responsive SaaS landing page in a single HTML file with a hero, features grid, pricing table and smooth scroll animations." },
  { title: "Make a game", sub: "Playable Snake in HTML5 canvas", prompt: "Write a complete, polished Snake game in a single HTML file using canvas, with score, high score (localStorage), speed levels and a game-over screen." },
  { title: "React component", sub: "Kanban board with drag & drop", prompt: "Create a React Kanban board component (export default App) with three columns, add/delete cards and native HTML5 drag & drop. Style it nicely." },
  { title: "Roblox system", sub: "Secure Luau shop with DataStores", prompt: "Build a complete, secure Roblox shop system in strict Luau: a server ModuleScript with validated RemoteEvents and rate limiting, DataStore saving with session locking and retries, leaderstats coins, and a client LocalScript with a tweened shop GUI. Tell me exactly where each script goes." },
  { title: "Solve with Python", sub: "Algorithms, explained step by step", prompt: "Implement Dijkstra's algorithm in Python with a priority queue, explain its complexity, and run it on a small example graph printing the shortest paths." },
];

const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

function Typed({ text }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 1)), 45);
    return () => clearInterval(id);
  }, [text]);
  return (
    <>
      {text.slice(0, n)}
      <span className={`type-caret ${n >= text.length ? "blink" : ""}`} />
    </>
  );
}

export default function App() {
  const [settings, setSettingsState] = useState(loadSettings);
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panel, setPanel] = useState(null); // { msgId, index, follow }
  const [expanded, setExpanded] = useState(false);
  const [serverConfig, setServerConfig] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [liveId, setLiveId] = useState(null); // last generated message (drives panel auto-open)
  const [atBottom, setAtBottom] = useState(true);
  const ctrl = useRef(null);
  const scroller = useRef(null);
  const dismissed = useRef(new Set());
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  const setSettings = useCallback((patch) => setSettingsState((s) => ({ ...s, ...patch })), []);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    const t = setTimeout(() => saveChats(chats), 400);
    return () => clearTimeout(t);
  }, [chats]);
  useEffect(() => {
    fetchConfig().then(setServerConfig);
  }, []);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const chat = chats.find((c) => c.id === activeId) || null;
  const messages = chat?.messages || [];

  const updateMsg = useCallback((chatId, msgId, fn) => {
    setChats((cs) =>
      cs.map((c) => (c.id !== chatId ? c : { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...fn(m) } : m)) }))
    );
  }, []);

  // ---------------------------------------------------------------- generation
  const run = useCallback(
    async (chatId, history, assistantId) => {
      const model = getModel(settings.model);
      const controller = new AbortController();
      ctrl.current = controller;
      setBusyId(assistantId);
      setLiveId(assistantId);
      const started = performance.now();
      let gotContent = false;
      // Batch token updates into animation frames.
      let pending = { content: "", reasoning: "" };
      let raf = null;
      const flush = () => {
        raf = null;
        const p = pending;
        pending = { content: "", reasoning: "" };
        if (!p.content && !p.reasoning) return;
        updateMsg(chatId, assistantId, (m) => ({ content: m.content + p.content, reasoning: (m.reasoning || "") + p.reasoning }));
      };
      const queue = () => raf ?? (raf = requestAnimationFrame(flush));

      try {
        await streamChat(
          {
            provider: model.provider,
            model: model.id,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            system: settings.systemPrompt,
            reasoning: settings.reasoning,
            maxTokens: Math.min(settings.maxTokens, model.maxOut),
            temperature: settings.temperature,
            apiKey: settings.apiKeys?.[model.provider] || undefined,
          },
          (ev) => {
            if (ev.type === "reasoning") {
              pending.reasoning += ev.text;
              queue();
            } else if (ev.type === "content") {
              if (!gotContent) {
                gotContent = true;
                const secs = (performance.now() - started) / 1000;
                updateMsg(chatId, assistantId, (m) => (m.reasoning ? { thoughtSeconds: secs } : {}));
              }
              pending.content += ev.text;
              queue();
            } else if (ev.type === "usage") updateMsg(chatId, assistantId, () => ({ usage: ev.usage }));
            else if (ev.type === "finish") updateMsg(chatId, assistantId, () => ({ finish: ev.reason }));
            else if (ev.type === "error") updateMsg(chatId, assistantId, () => ({ error: ev.message }));
          },
          controller.signal
        );
      } catch (err) {
        if (err.name !== "AbortError") updateMsg(chatId, assistantId, () => ({ error: err.message || String(err) }));
      } finally {
        if (raf) cancelAnimationFrame(raf);
        flush();
        const secs = (performance.now() - started) / 1000;
        updateMsg(chatId, assistantId, (m) => ({ streaming: false, thoughtSeconds: m.thoughtSeconds ?? (m.reasoning ? secs : undefined) }));
        setBusyId(null);
        ctrl.current = null;
      }
    },
    [settings, updateMsg]
  );

  const send = useCallback(
    (text, files = []) => {
      if (busyId) return;
      const model = getModel(settings.model);
      let content = text;
      for (const f of files) {
        const ext = f.name.split(".").pop();
        content += `\n\nFile: \`${f.name}\`\n\`\`\`${ext}\n${f.content}\n\`\`\``;
      }
      const userMsg = { id: uid(), role: "user", content, display: text || files.map((f) => f.name).join(", "), files: files.map((f) => ({ name: f.name })) };
      const asst = { id: uid(), role: "assistant", content: "", reasoning: "", streaming: true, model: model.id, reasoningLevel: settings.reasoning };
      let chatId = activeId;
      let history;
      if (!chatId || !chatsRef.current.some((c) => c.id === chatId)) {
        chatId = uid();
        const title = (text || files[0]?.name || "New chat").replace(/\s+/g, " ").slice(0, 48);
        history = [userMsg];
        setChats((cs) => [{ id: chatId, title, createdAt: Date.now(), updatedAt: Date.now(), messages: [userMsg, asst] }, ...cs]);
        setActiveId(chatId);
      } else {
        history = [...chatsRef.current.find((c) => c.id === chatId).messages.filter((m) => !m.error || m.content), userMsg];
        setChats((cs) => cs.map((c) => (c.id === chatId ? { ...c, updatedAt: Date.now(), messages: [...c.messages, userMsg, asst] } : c)));
      }
      setAtBottom(true);
      requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }));
      run(chatId, history, asst.id);
    },
    [activeId, busyId, settings.model, settings.reasoning, run]
  );

  const regenerate = useCallback(() => {
    if (busyId || !chat) return;
    const msgs = chat.messages;
    let lastUser = msgs.length - 1;
    while (lastUser >= 0 && msgs[lastUser].role !== "user") lastUser--;
    if (lastUser < 0) return;
    const model = getModel(settings.model);
    const asst = { id: uid(), role: "assistant", content: "", reasoning: "", streaming: true, model: model.id, reasoningLevel: settings.reasoning };
    const kept = msgs.slice(0, lastUser + 1);
    setChats((cs) => cs.map((c) => (c.id === chat.id ? { ...c, messages: [...kept, asst] } : c)));
    run(chat.id, kept, asst.id);
  }, [busyId, chat, settings.model, settings.reasoning, run]);

  const editUser = useCallback(
    (msgId, text) => {
      if (busyId || !chat) return;
      const i = chat.messages.findIndex((m) => m.id === msgId);
      if (i < 0) return;
      const model = getModel(settings.model);
      const old = chat.messages[i];
      const filesPart = old.content.slice((old.display ?? "").length);
      const edited = { ...old, content: text + (old.files?.length ? filesPart : ""), display: text };
      const kept = [...chat.messages.slice(0, i), edited];
      const asst = { id: uid(), role: "assistant", content: "", reasoning: "", streaming: true, model: model.id, reasoningLevel: settings.reasoning };
      setChats((cs) => cs.map((c) => (c.id === chat.id ? { ...c, messages: [...kept, asst] } : c)));
      run(chat.id, kept, asst.id);
    },
    [busyId, chat, settings.model, settings.reasoning, run]
  );

  const stop = () => ctrl.current?.abort();

  // ---------------------------------------------------------------- code panel
  const panelMsg = panel && messages.find((m) => m.id === panel.msgId);
  const panelBlocks = useMemo(() => (panelMsg ? extractCodeBlocks(panelMsg.content) : []), [panelMsg?.content]); // eslint-disable-line

  // Auto-open the panel when the streaming answer starts writing a substantial / previewable block.
  const streamingMsg = messages.find((m) => m.id === liveId);
  useEffect(() => {
    if (!settings.autoOpenPanel || !streamingMsg?.content || dismissed.current.has(streamingMsg.id)) return;
    const blocks = extractCodeBlocks(streamingMsg.content);
    if (!blocks.length) return;
    const last = blocks.length - 1;
    const b = blocks[last];
    const worth = canPreview(b.lang) || b.code.split("\n").length >= 12;
    if (!worth) return;
    setPanel((p) => {
      if (p && p.msgId === streamingMsg.id) return p.follow && p.index !== last ? { ...p, index: last } : p;
      return { msgId: streamingMsg.id, index: last, follow: true };
    });
  }, [streamingMsg?.content, streamingMsg?.id, settings.autoOpenPanel]); // eslint-disable-line

  const openCode = useCallback(
    (msgId, code) => {
      const msg = chatsRef.current.flatMap((c) => c.messages).find((m) => m.id === msgId);
      const blocks = msg ? extractCodeBlocks(msg.content) : [];
      let idx = blocks.findIndex((b) => b.code === code || b.code.trimEnd() === code.trimEnd());
      if (idx < 0) idx = blocks.length - 1;
      setPanel({ msgId, index: Math.max(0, idx), follow: false });
    },
    []
  );

  const closePanel = () => {
    if (panel) dismissed.current.add(panel.msgId);
    setPanel(null);
    setExpanded(false);
  };

  useEffect(() => {
    if (panel && !panelMsg) setPanel(null);
  }, [panel, panelMsg]);

  // ---------------------------------------------------------------- scrolling
  useEffect(() => {
    if (atBottom && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  });
  const onScroll = (e) => {
    const el = e.currentTarget;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  // ---------------------------------------------------------------- chats
  const newChat = () => {
    if (busyId) stop();
    setActiveId(null);
    setPanel(null);
    if (isMobile()) setSidebarOpen(false);
  };
  const selectChat = (id) => {
    setActiveId(id);
    setPanel(null);
    setAtBottom(true);
    if (isMobile()) setSidebarOpen(false);
  };
  const deleteChat = (id) => {
    if (id === activeId) newChat();
    setChats((cs) => cs.filter((c) => c.id !== id));
  };
  const renameChat = (id, title) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));

  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") (e.preventDefault(), newChat());
      if ((e.metaKey || e.ctrlKey) && e.key === ",") (e.preventDefault(), setSettingsOpen(true));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const empty = messages.length === 0;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className={`app ${sidebarOpen ? "sb-open" : "sb-closed"} ${panel ? "has-panel" : ""} ${expanded ? "panel-expanded" : ""}`}>
      <Sidebar
        open={sidebarOpen}
        chats={chats}
        activeId={activeId}
        onNew={newChat}
        onSelect={selectChat}
        onDelete={deleteChat}
        onRename={renameChat}
        onToggle={() => setSidebarOpen(false)}
        onSettings={() => setSettingsOpen(true)}
      />
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <div className="tb-left">
            {!sidebarOpen && (
              <>
                <button className="icon-btn" onClick={() => setSidebarOpen(true)} title="Open sidebar">
                  <span className="hide-mobile"><IconSidebar size={19} /></span>
                  <span className="show-mobile"><IconMenu size={20} /></span>
                </button>
                <button className="icon-btn" onClick={newChat} title="New chat (Ctrl+J)">
                  <IconPlus size={19} />
                </button>
              </>
            )}
          </div>
          <div className="tb-title">{chat ? chat.title : ""}</div>
          <div className="tb-right">
            <button className="icon-btn show-mobile" onClick={() => setSettingsOpen(true)} title="Settings">
              <IconSettings size={18} />
            </button>
          </div>
        </header>

        {empty ? (
          <div className="welcome">
            <div className="welcome-inner">
              <div className="welcome-head">
                <Logo size={56} animated />
                <h1>
                  <Typed text="Hi, I'm FlairGPT." />
                </h1>
              </div>
              <p className="welcome-sub">Your AI coding agent powered by Lorn’s Flair 5.5. How can I help you build today?</p>
              <Composer settings={settings} setSettings={setSettings} onSend={send} onStop={stop} busy={Boolean(busyId)} centered />
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={s.title} className="suggestion" style={{ animationDelay: `${0.25 + i * 0.07}s` }} onClick={() => send(s.prompt)}>
                    <span className="s-title">{s.title}</span>
                    <span className="s-sub">{s.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="thread" ref={scroller} onScroll={onScroll}>
              <div className="thread-inner">
                {messages.map((m) => (
                  <Message
                    key={m.id}
                    msg={m}
                    settings={settings}
                    isLast={m === lastAssistant}
                    canEdit={!busyId}
                    onOpenCode={openCode}
                    onRegenerate={regenerate}
                    onEdit={(t) => editUser(m.id, t)}
                  />
                ))}
              </div>
            </div>
            {!atBottom && (
              <button className="to-bottom" onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })} title="Scroll to bottom">
                <IconChevron size={18} />
              </button>
            )}
            <Composer settings={settings} setSettings={setSettings} onSend={send} onStop={stop} busy={Boolean(busyId)} />
          </>
        )}
      </main>

      {panel && panelBlocks.length > 0 && (
        <CodePanel
          key={panel.msgId}
          blocks={panelBlocks}
          index={Math.min(panel.index, panelBlocks.length - 1)}
          onIndex={(i) => setPanel((p) => ({ ...p, index: i, follow: false }))}
          streaming={panelMsg?.streaming}
          onClose={closePanel}
          expanded={expanded}
          onExpand={() => setExpanded((e) => !e)}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
        serverConfig={serverConfig}
        chats={chats}
        onClearChats={() => (setChats([]), newChat())}
      />
    </div>
  );
}
