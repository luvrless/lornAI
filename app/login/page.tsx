"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "../components/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "login failed");
      router.push("/overview");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to your investigation console.">
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <div className="alert alert-error" role="alert">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
            <span>{error}</span>
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" autoComplete="email" placeholder="you@company.com" className="input mt-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" placeholder="••••••••" autoComplete="current-password" className="input mt-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn-primary mt-2 w-full !py-2.5" disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="divider my-6" />
      <p className="text-center text-sm text-muted">
        No account? <Link href="/register" className="link font-medium">Create one</Link>
      </p>
    </AuthShell>
  );
}
