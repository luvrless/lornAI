import { useEffect, useRef, useState } from "react";
import { MODELS, REASONING_LEVELS, getModel, PROVIDER_LABEL } from "../lib/models.js";
import { IconBrain, IconChevron, IconPaperclip, IconSend, IconStop, IconX, IconFile, IconCheck } from "./Icons.jsx";

const MAX_FILE = 400_000;

function useClickOutside(ref, onOut) {
  useEffect(() => {
    // The dropdown's anchor (its parent) owns the toggle button, so clicks there don't count as outside.
    const h = (e) => ref.current && !ref.current.parentElement.contains(e.target) && onOut();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

function Dropdown({ open, onClose, children, className = "" }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  if (!open) return null;
  return (
    <div ref={ref} className={`dropdown ${className}`}>
      {children}
    </div>
  );
}

export default function Composer({ settings, setSettings, onSend, onStop, busy, centered }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [menu, setMenu] = useState(null); // 'model' | 'reason'
  const ta = useRef(null);
  const fileInput = useRef(null);
  const model = getModel(settings.model);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [text]);

  useEffect(() => {
    ta.current?.focus();
  }, []);

  const submit = () => {
    if (busy || (!text.trim() && !files.length)) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
  };

  const addFiles = async (list) => {
    const out = [];
    for (const f of list) {
      if (f.size > MAX_FILE) {
        out.push({ name: f.name, content: `[File too large to inline: ${(f.size / 1024).toFixed(0)} KB]` });
        continue;
      }
      out.push({ name: f.name, content: await f.text() });
    }
    setFiles((prev) => [...prev, ...out]);
  };

  const levelIdx = REASONING_LEVELS.findIndex((l) => l.id === settings.reasoning);

  return (
    <div className={`composer-wrap ${centered ? "centered" : ""}`}>
      <div
        className="composer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) addFiles([...e.dataTransfer.files]);
        }}
      >
        {files.length > 0 && (
          <div className="file-chips in-composer">
            {files.map((f, i) => (
              <span className="file-chip" key={i}>
                <IconFile size={13} /> {f.name}
                <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label="Remove file">
                  <IconX size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={ta}
          value={text}
          rows={centered ? 2 : 1}
          placeholder={`Message FlairGPT${model.provider !== "flair" ? ` (${model.name})` : ""}…`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && settings.enterToSend) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            const fs = [...(e.clipboardData?.files || [])];
            if (fs.length) {
              e.preventDefault();
              addFiles(fs);
            }
          }}
        />
        <div className="composer-bar">
          <div className="pills">
            <div className="pill-anchor">
              <button className={`pill ${settings.reasoning !== "low" ? "active" : ""}`} onClick={() => setMenu(menu === "reason" ? null : "reason")} title="Reasoning effort">
                <IconBrain size={15} />
                <span>Reasoning · {REASONING_LEVELS[levelIdx]?.label}</span>
                <span className="level-bars" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <i key={i} className={i <= levelIdx ? "on" : ""} />
                  ))}
                </span>
              </button>
              <Dropdown open={menu === "reason"} onClose={() => setMenu(null)}>
                <div className="dd-title">Reasoning effort</div>
                {REASONING_LEVELS.map((l) => (
                  <button key={l.id} className={`dd-item ${settings.reasoning === l.id ? "selected" : ""}`} onClick={() => (setSettings({ reasoning: l.id }), setMenu(null))}>
                    <div>
                      <div className="dd-name">{l.label}</div>
                      <div className="dd-desc">{l.desc}</div>
                    </div>
                    {settings.reasoning === l.id && <IconCheck size={16} />}
                  </button>
                ))}
              </Dropdown>
            </div>
            <div className="pill-anchor">
              <button className="pill" onClick={() => setMenu(menu === "model" ? null : "model")} title="Model">
                <span className={`prov-dot ${model.provider}`} />
                <span>{model.name}</span>
                <IconChevron size={13} />
              </button>
              <Dropdown open={menu === "model"} onClose={() => setMenu(null)} className="wide">
                {["flair", "gemini", "deepseek"].map((p) => (
                  <div key={p}>
                    <div className="dd-title">{PROVIDER_LABEL[p]}</div>
                    {MODELS.filter((m) => m.provider === p).map((m) => (
                      <button key={m.id} className={`dd-item ${settings.model === m.id ? "selected" : ""}`} onClick={() => (setSettings({ model: m.id }), setMenu(null))}>
                        <div>
                          <div className="dd-name">
                            {m.name} {m.badge && <span className="badge">{m.badge}</span>}
                          </div>
                          <div className="dd-desc">{m.desc}</div>
                        </div>
                        {settings.model === m.id && <IconCheck size={16} />}
                      </button>
                    ))}
                  </div>
                ))}
              </Dropdown>
            </div>
          </div>
          <div className="bar-right">
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => (addFiles([...e.target.files]), (e.target.value = ""))} />
            <button className="icon-btn" title="Attach files (code, text)" onClick={() => fileInput.current?.click()}>
              <IconPaperclip size={18} />
            </button>
            {busy ? (
              <button className="send-btn stop" onClick={onStop} title="Stop generating">
                <IconStop size={16} />
              </button>
            ) : (
              <button className="send-btn" onClick={submit} disabled={!text.trim() && !files.length} title="Send">
                <IconSend size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
      {!centered && <div className="disclaimer">Flair 5.5 is provided by abliteration.ai under its own terms & policies. AI output can be wrong — review code before running it.</div>}
    </div>
  );
}
