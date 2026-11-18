import { useEffect, useState } from "react";
import { MODELS, REASONING_LEVELS, PROVIDER_LABEL, getModel } from "../lib/models.js";
import { DEFAULT_SETTINGS, DEFAULT_SYSTEM_PROMPT } from "../lib/storage.js";
import { IconX, IconSliders, IconKey, IconShield, IconDatabase, IconSpark, IconBrain } from "./Icons.jsx";
import Logo from "./Logo.jsx";

const TABS = [
  { id: "model", label: "Model", icon: IconBrain },
  { id: "general", label: "General", icon: IconSliders },
  { id: "keys", label: "API Keys", icon: IconKey },
  { id: "data", label: "Data", icon: IconDatabase },
  { id: "terms", label: "Terms", icon: IconShield },
];

const TOKEN_PRESETS = [2048, 8192, 16384, 32768, 65536, 131072];

function Row({ title, desc, children, stack }) {
  return (
    <div className={`set-row ${stack ? "stack" : ""}`}>
      <div className="set-text">
        <div className="set-title">{title}</div>
        {desc && <div className="set-desc">{desc}</div>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span />
    </button>
  );
}

function Segmented({ value, options, onChange }) {
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div className="segmented" style={{ "--n": options.length, "--i": idx }}>
      <span className="seg-thumb" />
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? "on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsModal({ open, onClose, settings, setSettings, serverConfig, onClearChats, chats }) {
  const [tab, setTab] = useState("model");
  const [closing, setClosing] = useState(false);
  const model = getModel(settings.model);
  const maxOut = model.maxOut;

  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line

  if (!open) return null;
  const close = () => {
    setClosing(true);
    setTimeout(() => (setClosing(false), onClose()), 180);
  };
  const set = (patch) => setSettings(patch);

  const exportChats = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(chats, null, 2)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `flairgpt-chats-${new Date().toISOString().slice(0, 10)}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className={`modal-backdrop ${closing ? "closing" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Settings">
        <nav className="modal-nav">
          <div className="modal-brand">
            <Logo size={26} /> Settings
          </div>
          {TABS.map((t) => (
            <button key={t.id} className={`nav-item ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
              <t.icon size={17} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="modal-main">
          <header className="modal-head">
            <h2>{TABS.find((t) => t.id === tab).label}</h2>
            <button className="icon-btn" onClick={close} aria-label="Close settings">
              <IconX size={19} />
            </button>
          </header>
          <div className="modal-content" key={tab}>
            {tab === "model" && (
              <>
                <Row title="Model" desc="Flair 5.5, powered by Lorn, is the main model. Gemini is the second model; DeepSeek is optional.">
                  <select value={settings.model} onChange={(e) => set({ model: e.target.value })}>
                    {["flair", "gemini", "deepseek"].map((p) => (
                      <optgroup key={p} label={PROVIDER_LABEL[p]}>
                        {MODELS.filter((m) => m.provider === p).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Row>
                <Row title="Reasoning" desc={REASONING_LEVELS.find((l) => l.id === settings.reasoning)?.desc}>
                  <Segmented value={settings.reasoning} options={REASONING_LEVELS} onChange={(v) => set({ reasoning: v })} />
                </Row>
                <Row title="Max output tokens" desc={`Upper limit for one reply, including reasoning. ${model.name} supports up to ${maxOut.toLocaleString()}.`} stack>
                  <div className="tokens">
                    <input
                      type="range"
                      min={1024}
                      max={maxOut}
                      step={1024}
                      value={Math.min(settings.maxTokens, maxOut)}
                      onChange={(e) => set({ maxTokens: Number(e.target.value) })}
                      style={{ "--p": `${((Math.min(settings.maxTokens, maxOut) - 1024) / (maxOut - 1024)) * 100}%` }}
                    />
                    <input
                      type="number"
                      className="num"
                      min={256}
                      max={maxOut}
                      value={settings.maxTokens}
                      onChange={(e) => set({ maxTokens: Math.max(256, Math.min(maxOut, Number(e.target.value) || 256)) })}
                    />
                  </div>
                  <div className="chips">
                    {TOKEN_PRESETS.filter((t) => t <= maxOut).map((t) => (
                      <button key={t} className={`chip ${settings.maxTokens === t ? "on" : ""}`} onClick={() => set({ maxTokens: t })}>
                        {t >= 1024 ? `${t / 1024}K` : t}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="Temperature" desc="Lower = focused and deterministic, higher = more creative.">
                  <div className="temp">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={settings.temperature}
                      onChange={(e) => set({ temperature: Number(e.target.value) })}
                      style={{ "--p": `${(settings.temperature / 2) * 100}%` }}
                    />
                    <span className="num-label">{settings.temperature.toFixed(2)}</span>
                  </div>
                </Row>
                <Row title="System prompt" desc="Instructions sent with every message. Fully under your control." stack>
                  <textarea className="sys-prompt" value={settings.systemPrompt} onChange={(e) => set({ systemPrompt: e.target.value })} rows={10} spellCheck={false} />
                  <div className="sys-foot">
                    <span>{settings.systemPrompt.length.toLocaleString()} characters</span>
                    <button className="btn-ghost" onClick={() => set({ systemPrompt: DEFAULT_SYSTEM_PROMPT })}>
                      Reset to default
                    </button>
                  </div>
                </Row>
              </>
            )}

            {tab === "general" && (
              <>
                <Row title="Theme">
                  <Segmented
                    value={settings.theme}
                    options={[
                      { id: "system", label: "System" },
                      { id: "light", label: "Light" },
                      { id: "dark", label: "Dark" },
                    ]}
                    onChange={(v) => set({ theme: v })}
                  />
                </Row>
                <Row title="Typing animation" desc="How replies are revealed while they stream.">
                  <Segmented
                    value={settings.typingSpeed}
                    options={[
                      { id: "off", label: "Off" },
                      { id: "normal", label: "Smooth" },
                      { id: "fast", label: "Fast" },
                    ]}
                    onChange={(v) => set({ typingSpeed: v })}
                  />
                </Row>
                <Row title="Auto-open code panel" desc="Open the live preview panel automatically when the model writes code.">
                  <Toggle checked={settings.autoOpenPanel} onChange={(v) => set({ autoOpenPanel: v })} />
                </Row>
                <Row title="Show reasoning" desc="Display the model's thinking process above each answer.">
                  <Toggle checked={settings.showReasoning} onChange={(v) => set({ showReasoning: v })} />
                </Row>
                <Row title="Enter to send" desc="When off, use the send button (Shift+Enter always adds a new line).">
                  <Toggle checked={settings.enterToSend} onChange={(v) => set({ enterToSend: v })} />
                </Row>
              </>
            )}

            {tab === "keys" && (
              <>
                <p className="set-note">
                  Keys are normally configured on the server (environment variables / Worker secrets) and never reach the browser. You can optionally override them
                  here — overrides are stored only in this browser and sent with your requests.
                </p>
                {[
                  { id: "flair", label: "Flair by Lorn (abliteration.ai API)", env: "FLAIR_API_KEY", ph: "ak_…" },
                  { id: "gemini", label: "Gemini (Google)", env: "GEMINI_API_KEY", ph: "AIza… / AQ.…" },
                  { id: "deepseek", label: "DeepSeek", env: "DEEPSEEK_API_KEY", ph: "sk-…" },
                ].map((p) => {
                  const configured = serverConfig?.providers?.[p.id]?.configured;
                  return (
                    <Row
                      key={p.id}
                      title={
                        <>
                          {p.label}{" "}
                          <span className={`status ${configured || settings.apiKeys[p.id] ? "ok" : "missing"}`}>
                            {settings.apiKeys[p.id] ? "Browser override" : configured ? "Server key active" : "Not configured"}
                          </span>
                        </>
                      }
                      desc={`Server variable: ${p.env}`}
                      stack
                    >
                      <input
                        type="password"
                        className="text-input"
                        autoComplete="off"
                        placeholder={p.ph}
                        value={settings.apiKeys[p.id]}
                        onChange={(e) => set({ apiKeys: { ...settings.apiKeys, [p.id]: e.target.value } })}
                      />
                    </Row>
                  );
                })}
              </>
            )}

            {tab === "data" && (
              <>
                <Row title="Export chats" desc={`${chats.length} conversation${chats.length === 1 ? "" : "s"} stored in this browser.`}>
                  <button className="btn-ghost" onClick={exportChats}>
                    Export JSON
                  </button>
                </Row>
                <Row title="Delete all chats" desc="Permanently removes every conversation from this browser.">
                  <button className="btn-danger" onClick={() => confirm("Delete all chats? This cannot be undone.") && onClearChats()}>
                    Delete all
                  </button>
                </Row>
                <Row title="Reset settings" desc="Restore every setting to its default value (API key overrides included).">
                  <button className="btn-ghost" onClick={() => set({ ...DEFAULT_SETTINGS })}>
                    Reset
                  </button>
                </Row>
              </>
            )}

            {tab === "terms" && (
              <div className="terms">
                <div className="terms-card">
                  <IconSpark size={20} />
                  <div>
                    <h3>Flair 5.5 — powered by Lorn</h3>
                    <p>
                      FlairGPT’s main model, <strong>Flair 5.5</strong>, is powered by <strong>Lorn</strong> and served by <a href="https://abliteration.ai/" target="_blank" rel="noreferrer">abliteration.ai</a>{" "}
                      through its OpenAI-compatible API (<code>api.abliteration.ai/v1</code>). Use of the API and API key is governed solely by abliteration.ai’s
                      own terms of service, usage policies and privacy policy.
                    </p>
                    <p>
                      FlairGPT does not add its own content policies, filters or restrictions on top of the provider. The system prompt is entirely yours to configure in{" "}
                      <em>Settings → Model</em>.
                    </p>
                    <a className="btn-ghost inline" href="https://abliteration.ai/" target="_blank" rel="noreferrer">
                      View abliteration.ai terms & policies ↗
                    </a>
                  </div>
                </div>
                <div className="terms-card subtle">
                  <div>
                    <h3>Secondary models</h3>
                    <p>
                      Gemini models are provided by Google and subject to the Gemini API Terms. DeepSeek models are provided by DeepSeek and subject to DeepSeek’s Open Platform
                      terms. Each provider’s terms apply when you select its model.
                    </p>
                  </div>
                </div>
                <div className="terms-card subtle">
                  <div>
                    <h3>Your data</h3>
                    <p>
                      Conversations and settings are stored only in your browser (localStorage). Messages are forwarded to the selected provider to generate replies.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
