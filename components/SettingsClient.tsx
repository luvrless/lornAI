"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SettingsClient({
  email,
  displayName,
  role,
  createdAt,
}: {
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [msg, setMsg] = useState<string | null>(null);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwdResult, setPwdResult] = useState<{ exposed: boolean; count: number; advice: string } | null>(null);
  const [pwdChecking, setPwdChecking] = useState(false);

  async function saveProfile() {
    const res = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: name }),
    });
    setMsg(res.ok ? "Profile saved." : "Failed to save.");
    router.refresh();
  }

  async function changePassword() {
    const res = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Password changed." : data.error || "Failed.");
    if (res.ok) { setCur(""); setNext(""); }
  }

  async function checkPwd() {
    setPwdChecking(true);
    setPwdResult(null);
    try {
      const res = await fetch("/api/tools/pwned-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json();
      if (res.ok) setPwdResult(data);
    } finally {
      setPwdChecking(false);
      setPwd("");
    }
  }

  async function deleteAccount() {
    if (!confirm("Permanently delete your account and ALL your data? This cannot be undone.")) return;
    const res = await fetch("/api/auth/account", { method: "DELETE" });
    if (res.ok) { router.push("/"); router.refresh(); }
  }

  return (
    <div className="space-y-5">
      {msg && <div className="panel border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-300">{msg}</div>}

      <section className="panel p-5">
        <h2 className="mb-1 font-medium">Account</h2>
        <p className="mb-4 text-sm text-faint">Role: <span className="chip !py-0.5">{role}</span> · Member since {new Date(createdAt).toLocaleDateString()}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Email</label>
            <input className="input mt-1.5 opacity-60" value={email} disabled />
          </div>
          <div>
            <label className="label">Display name</label>
            <input className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <button onClick={saveProfile} className="btn-primary mt-4 !py-1.5">Save profile</button>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 font-medium">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Current password</label>
            <input type="password" className="input mt-1.5" value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div>
            <label className="label">New password</label>
            <input type="password" className="input mt-1.5" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
        </div>
        <button onClick={changePassword} className="btn mt-4 !py-1.5" disabled={!cur || next.length < 8}>Update password</button>
      </section>

      <section className="panel p-5">
        <h2 className="mb-1 font-medium">Password exposure check</h2>
        <p className="mb-4 text-sm text-faint">
          Privacy-preserving: the password is hashed locally and only a 5-character SHA-1 prefix is sent (k-anonymity). It is never stored.
        </p>
        <div className="flex gap-2">
          <input type="password" className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Password to check" />
          <button onClick={checkPwd} className="btn-primary flex-none !py-1.5" disabled={!pwd || pwdChecking}>
            {pwdChecking ? "Checking…" : "Check"}
          </button>
        </div>
        {pwdResult && (
          <div className={`mt-3 rounded-lg border p-3 text-sm ${pwdResult.exposed ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
            {pwdResult.exposed ? `⚠ Found in ${pwdResult.count.toLocaleString()} breach records.` : "✓ Not found in known breach corpora."}
            <div className="mt-1 text-xs opacity-80">{pwdResult.advice}</div>
          </div>
        )}
      </section>

      <section className="panel border-red-500/20 p-5">
        <h2 className="mb-1 font-medium text-red-300">Danger zone</h2>
        <p className="mb-4 text-sm text-faint">Deleting your account removes all investigations, cases and API keys immediately.</p>
        <button onClick={deleteAccount} className="btn !border-red-500/40 !text-red-300 hover:!bg-red-500/10">Delete account</button>
      </section>
    </div>
  );
}
