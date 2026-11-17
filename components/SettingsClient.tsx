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
      {msg && (
        <div key={msg} className="alert alert-success" role="status">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          <span>{msg}</span>
        </div>
      )}

      <section className="panel animate-rise p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-xl font-semibold text-white shadow-glow">{(name || email)[0]?.toUpperCase()}</div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight">Account</h2>
            <p className="mt-0.5 text-sm text-faint">Role: <span className="chip !py-0.5 capitalize">{role}</span> · Member since {new Date(createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Email</label>
            <input className="input mt-2 opacity-60" value={email} disabled />
          </div>
          <div>
            <label className="label">Display name</label>
            <input className="input mt-2" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <button onClick={saveProfile} className="btn-primary mt-5">Save profile</button>
      </section>

      <section className="panel animate-rise p-5 sm:p-6" style={{ animationDelay: "60ms" }}>
        <h2 className="text-[15px] font-semibold tracking-tight">Change password</h2>
        <p className="mb-5 mt-1 text-sm text-faint">Use at least 8 characters.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Current password</label>
            <input type="password" autoComplete="current-password" className="input mt-2" value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div>
            <label className="label">New password</label>
            <input type="password" autoComplete="new-password" className="input mt-2" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
        </div>
        <button onClick={changePassword} className="btn mt-5" disabled={!cur || next.length < 8}>Update password</button>
      </section>

      <section className="panel animate-rise p-5 sm:p-6" style={{ animationDelay: "120ms" }}>
        <h2 className="text-[15px] font-semibold tracking-tight">Password exposure check</h2>
        <p className="mb-5 mt-1 text-sm leading-relaxed text-faint">
          Privacy-preserving: the password is hashed locally and only a 5-character SHA-1 prefix is sent (k-anonymity). It is never stored.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input type="password" autoComplete="off" className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Password to check" />
          <button onClick={checkPwd} className="btn-primary flex-none" disabled={!pwd || pwdChecking}>
            {pwdChecking && <span className="spinner" />}
            {pwdChecking ? "Checking…" : "Check"}
          </button>
        </div>
        {pwdResult && (
          <div className={`alert mt-4 !block ${pwdResult.exposed ? "alert-error" : "alert-success"}`}>
            {pwdResult.exposed ? `⚠ Found in ${pwdResult.count.toLocaleString()} breach records.` : "✓ Not found in known breach corpora."}
            <div className="mt-1 text-xs opacity-80">{pwdResult.advice}</div>
          </div>
        )}
      </section>

      <section className="panel animate-rise !border-red-500/20 p-5 sm:p-6" style={{ animationDelay: "180ms", background: "linear-gradient(180deg, rgba(239,68,68,0.06), rgba(239,68,68,0.015))" }}>
        <h2 className="text-[15px] font-semibold tracking-tight text-red-300">Danger zone</h2>
        <p className="mb-5 mt-1 text-sm text-faint">Deleting your account removes all investigations, cases and API keys immediately.</p>
        <button onClick={deleteAccount} className="btn !border-red-500/35 !bg-red-500/[0.06] !text-red-300 hover:!bg-red-500/15">Delete account</button>
      </section>
    </div>
  );
}
