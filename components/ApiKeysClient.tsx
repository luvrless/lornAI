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
    <div className="panel p-5">
      <h2 className="mb-3 font-medium">API keys</h2>
      {secret && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm text-amber-200">Copy your key now — it won&apos;t be shown again.</p>
          <code className="mono mt-2 block break-all rounded bg-ink-950/70 p-2 text-xs text-white">{secret}</code>
          <button onClick={() => { navigator.clipboard.writeText(secret); }} className="btn mt-2 !py-1">Copy</button>
        </div>
      )}
      <div className="flex gap-2">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. CI pipeline)" />
        <button onClick={create} className="btn-primary flex-none !py-1.5" disabled={creating || !name.trim()}>Create key</button>
      </div>
      <div className="mt-4 divide-y divide-white/5">
        {keys.length === 0 && <p className="py-4 text-sm text-faint">No keys yet.</p>}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-medium">{k.name}</div>
              <div className="mono text-xs text-faint">{k.prefix}••• · {k.scopes.length} scopes · {k.lastUsedAt ? `used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}</div>
            </div>
            <button onClick={() => revoke(k.id)} className="text-xs text-red-300 hover:underline">Revoke</button>
          </div>
        ))}
      </div>
    </div>
  );
}
