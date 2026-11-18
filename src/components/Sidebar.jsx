import { useState } from "react";
import Logo from "./Logo.jsx";
import { IconPlus, IconSettings, IconSidebar, IconTrash, IconEdit, IconCheck, IconX } from "./Icons.jsx";

function group(chats) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups = [
    ["Today", (t) => t >= startOfDay],
    ["Yesterday", (t) => t >= startOfDay - 864e5],
    ["Previous 7 Days", (t) => t >= startOfDay - 7 * 864e5],
    ["Previous 30 Days", (t) => t >= startOfDay - 30 * 864e5],
    ["Older", () => true],
  ];
  const out = groups.map(([label]) => ({ label, items: [] }));
  for (const c of [...chats].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const i = groups.findIndex(([, f]) => f(c.updatedAt));
    out[i].items.push(c);
  }
  return out.filter((g) => g.items.length);
}

function ChatItem({ chat, active, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const [confirm, setConfirm] = useState(false);

  if (editing) {
    return (
      <div className="chat-item editing">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (onRename(title.trim() || chat.title), setEditing(false));
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => (onRename(title.trim() || chat.title), setEditing(false))}
        />
      </div>
    );
  }
  return (
    <div className={`chat-item ${active ? "active" : ""}`} onClick={onSelect} title={chat.title}>
      <span className="chat-title">{chat.title}</span>
      <span className="chat-actions" onClick={(e) => e.stopPropagation()}>
        {confirm ? (
          <>
            <button className="mini danger" onClick={onDelete} title="Confirm delete">
              <IconCheck size={14} />
            </button>
            <button className="mini" onClick={() => setConfirm(false)} title="Cancel">
              <IconX size={14} />
            </button>
          </>
        ) : (
          <>
            <button className="mini" onClick={() => (setTitle(chat.title), setEditing(true))} title="Rename">
              <IconEdit size={14} />
            </button>
            <button className="mini" onClick={() => setConfirm(true)} title="Delete">
              <IconTrash size={14} />
            </button>
          </>
        )}
      </span>
    </div>
  );
}

export default function Sidebar({ open, chats, activeId, onNew, onSelect, onDelete, onRename, onToggle, onSettings }) {
  const groups = group(chats);
  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      <div className="sb-top">
        <div className="brand">
          <Logo size={30} />
          <span className="brand-name">FlairGPT</span>
        </div>
        <button className="icon-btn" onClick={onToggle} title="Close sidebar">
          <IconSidebar size={19} />
        </button>
      </div>
      <button className="new-chat" onClick={onNew}>
        <IconPlus size={17} />
        <span>New chat</span>
      </button>
      <div className="chat-list">
        {groups.length === 0 && <div className="empty-list">No chats yet. Start a conversation!</div>}
        {groups.map((g) => (
          <div className="chat-group" key={g.label}>
            <div className="group-label">{g.label}</div>
            {g.items.map((c) => (
              <ChatItem
                key={c.id}
                chat={c}
                active={c.id === activeId}
                onSelect={() => onSelect(c.id)}
                onDelete={() => onDelete(c.id)}
                onRename={(t) => onRename(c.id, t)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="sb-bottom">
        <button className="sb-settings" onClick={onSettings}>
          <IconSettings size={18} />
          <span>Settings</span>
        </button>
        <div className="powered">
          Powered by <strong>Flair 5.5</strong>
        </div>
      </div>
    </aside>
  );
}
