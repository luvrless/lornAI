import { memo, useEffect, useRef, useState } from "react";
import Markdown, { useCopy } from "./Markdown.jsx";
import Logo from "./Logo.jsx";
import { useTypewriter } from "../lib/useTypewriter.js";
import { getModel } from "../lib/models.js";
import { IconBrain, IconCheck, IconChevron, IconCopy, IconRefresh, IconEdit, IconFile } from "./Icons.jsx";

function Reasoning({ text, streaming, seconds, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const thinking = streaming && seconds == null;
  return (
    <div className={`reasoning ${open ? "open" : ""}`}>
      <button className="reasoning-toggle" onClick={() => setOpen((o) => !o)}>
        <IconBrain size={15} />
        <span className={thinking ? "shimmer" : ""}>{thinking ? "Thinking…" : `Thought for ${Math.max(1, Math.round(seconds || 0))} seconds`}</span>
        <IconChevron size={14} className="chev" />
      </button>
      <div className="reasoning-body-wrap">
        <div className="reasoning-body">{text}</div>
      </div>
    </div>
  );
}

function AssistantMessage({ msg, isLast, settings, onOpenCode, onRegenerate }) {
  // Latch: animate this message while (and after) it streams in this session.
  const animRef = useRef(Boolean(msg.streaming));
  if (msg.streaming) animRef.current = true;
  const { text, done } = useTypewriter(msg.content || "", animRef.current, settings.typingSpeed);
  const typing = msg.streaming || !done;
  const [copied, copy] = useCopy();
  const model = getModel(msg.model);
  const waiting = msg.streaming && !msg.content && !msg.reasoning;

  return (
    <div className="msg assistant">
      <div className="avatar">
        <Logo size={30} animated={typing} />
      </div>
      <div className="msg-body">
        {waiting && (
          <div className="dots" aria-label="Generating">
            <span />
            <span />
            <span />
          </div>
        )}
        {settings.showReasoning && msg.reasoning && (
          <Reasoning text={msg.reasoning} streaming={msg.streaming && !msg.content} seconds={msg.thoughtSeconds} defaultOpen={Boolean(msg.streaming)} />
        )}
        {text && (
          <div className={`markdown ${typing ? "typing" : ""}`}>
            <Markdown text={text} onOpenCode={(code, lang) => onOpenCode(msg.id, code, lang)} streaming={typing} />
          </div>
        )}
        {msg.error && (
          <div className="error-card">
            <strong>Something went wrong.</strong>
            <span>{msg.error}</span>
            {isLast && (
              <button className="btn-ghost" onClick={onRegenerate}>
                <IconRefresh size={14} /> Retry
              </button>
            )}
          </div>
        )}
        {msg.finish === "length" && !msg.streaming && (
          <div className="notice">Output hit the max-token limit. Increase “Max output tokens” in Settings or ask to continue.</div>
        )}
        {!msg.streaming && done && (msg.content || msg.error) && (
          <div className="msg-actions">
            {msg.content && (
              <button className="icon-btn" title="Copy" onClick={() => copy(msg.content)}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </button>
            )}
            {isLast && (
              <button className="icon-btn" title="Regenerate" onClick={onRegenerate}>
                <IconRefresh size={16} />
              </button>
            )}
            <span className="msg-meta">
              {model.name}
              {msg.reasoningLevel ? ` · ${msg.reasoningLevel}` : ""}
              {msg.usage?.completion_tokens ? ` · ${msg.usage.completion_tokens.toLocaleString()} tokens` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessage({ msg, onEdit, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(msg.content);
  const ref = useRef(null);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [editing]);
  if (editing) {
    return (
      <div className="msg user editing">
        <div className="edit-box">
          <textarea ref={ref} value={val} onChange={(e) => setVal(e.target.value)} rows={2} />
          <div className="edit-actions">
            <button className="btn-ghost" onClick={() => (setEditing(false), setVal(msg.content))}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => (setEditing(false), onEdit(val))} disabled={!val.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="msg user">
      {canEdit && (
        <button className="icon-btn edit-btn" title="Edit message" onClick={() => setEditing(true)}>
          <IconEdit size={15} />
        </button>
      )}
      <div className="bubble">
        {msg.files?.length > 0 && (
          <div className="file-chips">
            {msg.files.map((f) => (
              <span className="file-chip" key={f.name}>
                <IconFile size={13} /> {f.name}
              </span>
            ))}
          </div>
        )}
        {msg.display ?? msg.content}
      </div>
    </div>
  );
}

function Message(props) {
  return props.msg.role === "user" ? <UserMessage {...props} /> : <AssistantMessage {...props} />;
}

export default memo(Message);
