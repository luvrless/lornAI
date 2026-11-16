/** @jsxRuntime automatic @jsxImportSource react */
import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import "../styles.css";
import "../profile/profile.css";
import { SessionProvider, useSession } from "./session.tsx";
import { ConfirmProvider, Toasts } from "./ui.tsx";
import { useLocation } from "./router.tsx";
import { Landing, Login, Register, TwoFactor, VerifyCode, SignupComplete, ForgotPassword, ResetPassword, VerifyEmail, Legal, NotFound } from "./pages/public.tsx";
import { DashboardShell } from "./dashboard/shell.tsx";
import { AdminApp } from "./admin/admin.tsx";
import { ProfileView, type Payload } from "../profile/ProfileView.tsx";
import { useState, useEffect } from "react";

function PublicProfileRoute({ username, pageSlug }: { username: string; pageSlug?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/p/${encodeURIComponent(username)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "not_found" : "failed");
        return r.json();
      })
      .then((data) => {
        if (data?.payload) {
          setPayload(data.payload);
          const title = data.payload.config?.seo?.title || `${data.payload.config?.identity?.displayName || data.payload.user?.username || username} · LORN.LOL`;
          document.title = title;
        } else {
          setError("not_found");
        }
      })
      .catch((err) => {
        setError(err.message || "not_found");
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return <div className="boot" role="status" aria-label="Loading"><img src="/brand/mark-128.png" alt="" /><i /></div>;
  }

  if (error || !payload) {
    return (
      <div className="lp-missing" style={{ minHeight: "80vh", display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, marginBottom: 12 }}>Page not found</h1>
          <p style={{ color: "var(--mist)", marginBottom: 20 }}>lorn.lol/{username} is still available.</p>
          <a className="btn primary" href={`/register?username=${encodeURIComponent(username)}`}>Claim it</a>
        </div>
      </div>
    );
  }

  return <ProfileView payload={payload} mode="public" pageSlug={pageSlug} />;
}

/** A crash in one screen shows a recoverable message instead of blanking the app. Resets on navigation. */
class Boundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) { return { error }; }
  static getDerivedStateFromProps(p: { resetKey: string }, s: { error: Error | null; key: string }) {
    return p.resetKey !== s.key ? { error: null, key: p.resetKey } : null;
  }
  componentDidCatch(error: Error) { console.error("Screen crashed:", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>This screen ran into a problem</h1>
        <p>Your saved work is safe. Reload to try again. If it keeps happening, send support the details below.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn primary" onClick={() => location.reload()}>Reload</button>
          <a className="btn" href="/dashboard">Back to overview</a>
        </div>
        <details className="crash-detail"><summary>Technical details</summary><pre>{String(this.state.error?.message ?? this.state.error)}{"\n"}{location.pathname}</pre></details>
      </div>
    );
  }
}

function Routes() {
  const { pathname } = useLocation();
  if (pathname === "/") return <Landing />;
  if (pathname === "/login") return <Login />;
  if (pathname === "/login/2fa") return <TwoFactor />;
  if (pathname === "/verify") return <VerifyCode />;
  if (pathname === "/register") return <Register />;
  if (pathname === "/signup/complete") return <SignupComplete />;
  if (pathname === "/forgot-password") return <ForgotPassword />;
  if (pathname === "/reset-password") return <ResetPassword />;
  if (pathname === "/verify-email") return <VerifyEmail />;
  if (pathname === "/terms") return <Legal kind="terms" />;
  if (pathname === "/privacy") return <Legal kind="privacy" />;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return <DashboardShell />;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return <AdminApp />;

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 1 && parts.length <= 2 && /^[A-Za-z0-9_.]{1,12}$/.test(parts[0])) {
    return <PublicProfileRoute username={parts[0]} pageSlug={parts[1] ?? null} />;
  }

  return <NotFound />;
}

function ServerBanner() {
  const { serverProblem } = useSession();
  return serverProblem ? <div className="server-banner" role="alert">{serverProblem}</div> : null;
}

function RoutedBoundary() {
  const { pathname } = useLocation();
  return <><ServerBanner /><Boundary resetKey={pathname}><Routes /></Boundary></>;
}

document.body.classList.add("app-bg");
createRoot(document.getElementById("root")!).render(
  <SessionProvider><ConfirmProvider><RoutedBoundary /><Toasts /></ConfirmProvider></SessionProvider>,
);
