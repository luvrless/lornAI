"use client";
import { useState } from "react";

type Key = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; lastUsedAt?: string | null };

export function ApiKeysClient({ initial }: { initial: Key[] }) {
  const [keys, setKeys] = useState(initial);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok) {
        setSecret(data.secret);
        setKeys((k) => [{ id: data.key.id, name: data.key.name, prefix: data.secret.slice(0, 14), scopes: data.key.scopes, createdAt: new Date().toISOString() }, ...k]);
        setName("");
      }
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? Requests using it will immediately stop working.")) return;
    const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (res.ok) setKeys((k) => k.filter((x) => x.id !== id));
  }

  return (
    <div className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight">API keys</h2>
        <span className="chip !py-0.5 text-[11px] tabular-nums">{keys.length} active</span>
      </div>
      {secret && (
        <div className="alert alert-warn mb-4 !block">
          <p className="text-sm font-medium">Copy your key now — it won&apos;t be shown again.</p>
          <code className="mono mt-2.5 block break-all rounded-lg border border-white/10 bg-black/40 p-2.5 text-xs text-white">{secret}</code>
          <button onClick={() => { navigator.clipboard.writeText(secret); }} className="btn mt-2.5 !py-1.5 text-xs">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9h10v10H9zM5 15V5h10" /></svg>
            Copy
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. CI pipeline)" />
        <button onClick={create} className="btn-primary flex-none" disabled={creating || !name.trim()}>
          {creating && <span className="spinner" />}
          Create key
        </button>
      </div>
      <div className="mt-5 divide-y divide-white/[0.05]">
        {keys.length === 0 && <p className="py-6 text-center text-sm text-faint">No keys yet.</p>}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="icon-tile h-9 w-9">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 1 15 7z" /></svg>
              </div>
              <div className="min-w-0">
              <div className="text-sm font-medium">{k.name}</div>
              <div className="mono truncate text-xs text-faint">{k.prefix}••• · {k.scopes.length} scopes · {k.lastUsedAt ? `used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}</div>
              </div>
            </div>
            <button onClick={() => revoke(k.id)} className="btn-danger flex-none">Revoke</button>
          </div>
        ))}
      </div>
    </div>
  );
}
