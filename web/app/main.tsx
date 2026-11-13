/** @jsxRuntime automatic @jsxImportSource react */
import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import "../styles.css";
import "../profile/profile.css";
import { SessionProvider } from "./session.tsx";
import { ConfirmProvider, Toasts } from "./ui.tsx";
import { useLocation } from "./router.tsx";
import { Landing, Login, Register, TwoFactor, SignupComplete, ForgotPassword, ResetPassword, VerifyEmail, Legal, NotFound } from "./pages/public.tsx";
import { DashboardShell } from "./dashboard/shell.tsx";
import { AdminApp } from "./admin/admin.tsx";

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
        <p>Your saved work is safe. Reload to try again; if it keeps happening, contact support with what you were doing.</p>
        <button className="btn primary" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}

function Routes() {
  const { pathname } = useLocation();
  if (pathname === "/") return <Landing />;
  if (pathname === "/login") return <Login />;
  if (pathname === "/login/2fa") return <TwoFactor />;
  if (pathname === "/register") return <Register />;
  if (pathname === "/signup/complete") return <SignupComplete />;
  if (pathname === "/forgot-password") return <ForgotPassword />;
  if (pathname === "/reset-password") return <ResetPassword />;
  if (pathname === "/verify-email") return <VerifyEmail />;
  if (pathname === "/terms") return <Legal kind="terms" />;
  if (pathname === "/privacy") return <Legal kind="privacy" />;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return <DashboardShell />;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return <AdminApp />;
  return <NotFound />;
}

function RoutedBoundary() {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}><Routes /></Boundary>;
}

document.body.classList.add("app-bg");
createRoot(document.getElementById("root")!).render(
  <SessionProvider><ConfirmProvider><RoutedBoundary /><Toasts /></ConfirmProvider></SessionProvider>,
);
