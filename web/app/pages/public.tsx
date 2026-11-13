/** @jsxRuntime automatic @jsxImportSource react */
/** Landing, authentication and legal pages. */
import { useEffect, useMemo, useState } from "react";
import { SiDiscord, SiGoogle } from "react-icons/si";
import { LuCircleCheck, LuCircleAlert, LuLayers, LuMusic, LuChartLine, LuAward, LuPalette, LuShieldCheck } from "react-icons/lu";
import { get, post, ApiError } from "../api.ts";
import { Link, navigate, useLocation } from "../router.tsx";
import { Button, TextField, toast, useDebounced } from "../ui.tsx";
import { useSession } from "../session.tsx";
import { ProfileView, type Payload } from "../../profile/ProfileView.tsx";
import { defaultConfig } from "../../../shared/profile-schema.ts";

function Brand() { return <Link to="/" className="brand" style={{ padding: 0 }}><span className="mark" aria-hidden />LORN.LOL</Link>; }

/** A real profile rendered by the production renderer — not a screenshot. */
function useDemoPayload(username: string): Payload {
  return useMemo(() => {
    const c = defaultConfig();
    c.identity.displayName = username || "you";
    c.identity.bio = "Your corner of the internet — animated, yours, live in a minute.";
    c.identity.showUid = false; c.identity.showViews = false; c.identity.showJoined = false;
    c.background.effect = "galaxy"; c.background.effectColors = ["#1d4ed8", "#38bdf8", "#c4b5fd"]; c.background.speed = .6;
    c.card.width = 380; c.card.tilt3d = true; c.card.glow = 30; c.card.bgOpacity = 40;
    c.typography.font = "Sora"; c.typography.nameEffect = "decrypt"; c.typography.nameGradient = true;
    c.effects.overlay = "stars"; c.effects.density = 20;
    c.links = (["discord", "github", "spotify", "x", "twitch"] as const).map((p, i) => ({ id: `demo${i}xx`, platform: p, url: "https://lorn.lol", title: "", description: "", iconAssetId: null, iconOnly: true, featured: false, visible: true, archived: false, color: null, hover: "lift", startAt: null, endAt: null }));
    c.widgets = [{ id: "democlock1", type: "clock", visible: true, span: 1, config: { timezone: "Europe/Berlin", hour12: false, seconds: true } }];
    return {
      user: { uid: 1, username: username || "you", createdAt: new Date().toISOString(), premium: false, verified: false }, config: c, assets: {}, views: 0, integrations: {}, mode: "draft",
      badges: [
        { id: "d1", key: "og", name: "OG", tooltip: "OG", iconUrl: null, iconPreset: "flame", color: "#fb923c", gradientFrom: null, gradientTo: null, borderColor: null, glow: 30, hover: "lift" },
        { id: "d2", key: "early", name: "Early Supporter", tooltip: "Early Supporter", iconUrl: null, iconPreset: "heart", color: "#f472b6", gradientFrom: null, gradientTo: null, borderColor: null, glow: 0, hover: "lift" },
      ],
    };
  }, [username]);
}

export function Landing() {
  const [name, setName] = useState("");
  const check = useDebounced(name.trim(), 350);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const { me } = useSession();
  useEffect(() => {
    if (!check) { setStatus(null); return; }
    get(`/api/auth/username/${encodeURIComponent(check)}`).then((r) => setStatus(r.available ? { ok: true, msg: `lorn.lol/${check} is available` } : { ok: false, msg: r.reason })).catch((e) => setStatus({ ok: false, msg: e.message }));
  }, [check]);
  const demo = useDemoPayload(check);
  const claim = () => navigate(`/register${name ? `?username=${encodeURIComponent(name.trim())}` : ""}`);
  return (
    <div className="landing app-bg" style={{ minHeight: "100vh" }}>
      <nav><Brand /><div className="row">{me?.user ? <Link className="btn primary" to="/dashboard">Open dashboard</Link> : <><Link className="btn ghost" to="/login">Log in</Link><Link className="btn primary" to="/register">Create your page</Link></>}</div></nav>
      <section className="hero">
        <div>
          <h1 className="sr">Claim your LORN.LOL page</h1>
          <form className="claim" onSubmit={(e) => { e.preventDefault(); claim(); }}>
            <span className="host">lorn.lol/</span>
            <input value={name} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_.]/g, "").slice(0, 12))} placeholder="you" aria-label="Choose your username" maxLength={12} autoComplete="off" spellCheck={false} />
          </form>
          <div className="claim-status" aria-live="polite">
            {status && <span className="row" style={{ color: status.ok ? "var(--ok)" : "var(--bad)", gap: 6 }}>{status.ok ? <LuCircleCheck /> : <LuCircleAlert />}{status.msg}</span>}
          </div>
          <p className="lede">A profile page you can actually make your own: shader backgrounds, video, music, badges, widgets and a live editor that shows exactly what visitors will see.</p>
          <div className="row" style={{ marginTop: 28 }}>
            <Button kind="primary" size="lg" onClick={claim} disabled={status?.ok === false}>Claim {check ? `lorn.lol/${check}` : "your name"}</Button>
            <Link className="btn lg ghost" to="/login">I have an account</Link>
          </div>
        </div>
        <div className="hero-demo" aria-label="Live preview of a LORN.LOL profile"><ProfileView payload={demo} mode="preview" /></div>
      </section>
      <section className="features">
        {[
          [LuPalette, "A real editor", "Backgrounds, card, type, cursor and animations, with undo, autosave and version history."],
          [LuLayers, "Pages and widgets", "Split your profile into pages and fill them with GitHub, Roblox, Steam, clocks, galleries and more."],
          [LuMusic, "Music that plays", "Upload tracks, add timed lyrics, and choose from seven player styles."],
          [LuAward, "Badges that mean something", "Earn OG, event and milestone badges, or design your own."],
          [LuChartLine, "Honest analytics", "Views, clicks and referrers from real visitors. Bots are filtered out and IPs are never stored."],
          [LuShieldCheck, "Safe by design", "Two-factor sign-in and Argon2 passwords, and no custom code can run on your page."],
        ].map(([I, t, d]: any) => <div key={t}><I aria-hidden /><h3>{t}</h3><p>{d}</p></div>)}
      </section>
      <footer className="row" style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 28px 40px", color: "var(--dim)", fontSize: 13, justifyContent: "space-between" }}>
        <span>LORN.LOL</span><span className="row"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link></span>
      </footer>
    </div>
  );
}

function AuthFrame({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="auth-wrap app-bg">
      <div className="panel auth-card">
        <div style={{ marginBottom: 22 }}><Brand /></div>
        <h1>{title}</h1>{sub && <p className="muted" style={{ marginBottom: 18 }}>{sub}</p>}
        {children}
      </div>
    </div>
  );
}

function OAuthButtons({ next }: { next?: string }) {
  const [p, setP] = useState<{ discord: boolean; google: boolean } | null>(null);
  useEffect(() => { get("/api/auth/providers").then(setP).catch(() => {}); }, []);
  if (!p || (!p.discord && !p.google)) return null;
  const q = next ? `&next=${encodeURIComponent(next)}` : "";
  return <>
    <div className="col">
      {p.discord && <a className="btn oauth-btn" href={`/api/auth/discord/start?intent=login${q}`}><SiDiscord color="#5865F2" />Continue with Discord</a>}
      {p.google && <a className="btn oauth-btn" href={`/api/auth/google/start?intent=login${q}`}><SiGoogle />Continue with Google</a>}
    </div>
    <div className="or">or</div>
  </>;
}

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled.", oauth_state_mismatch: "That sign-in link expired or was opened in another browser. Try again.",
  oauth_state_expired: "That sign-in link expired. Try again.", oauth_exchange_failed: "The provider couldn't confirm your account. Try again.",
  account_banned: "This account is banned.", account_locked: "This account is locked. Contact support.", signup_disabled: "New sign-ups through this provider are paused.",
  oauth_invalid: "Sign-in failed. Try again.", login_disabled: "Login is temporarily disabled.",
};

export function Login() {
  const { refresh } = useSession();
  const { search } = useLocation();
  const [id, setId] = useState(""); const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(OAUTH_ERRORS[search.get("error") ?? ""] ?? null);
  const [busy, setBusy] = useState(false);
  const next = search.get("next") ?? "/dashboard";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await post("/api/auth/login", { identifier: id, password: pw });
      await refresh();
      navigate(r.mfaRequired ? `/login/2fa?next=${encodeURIComponent(next)}` : next);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Log in" sub={<>New here? <Link to="/register">Create a page</Link></>}>
      <OAuthButtons next={next} />
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <TextField label="Username or email" value={id} onChange={setId} autoComplete="username" required />
        <TextField label="Password" type="password" value={pw} onChange={setPw} autoComplete="current-password" required />
        {err && <div className="banner bad small">{err}</div>}
        <Button kind="primary" busy={busy} type="submit">Log in</Button>
        <Link to="/forgot-password" className="small">Forgot your password?</Link>
      </form>
    </AuthFrame>
  );
}

export function Register() {
  const { refresh } = useSession();
  const { search } = useLocation();
  const [f, setF] = useState({ username: search.get("username") ?? "", email: "", password: "", acceptTos: false });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [avail, setAvail] = useState<{ available: boolean; reason: string | null } | null>(null);
  const u = useDebounced(f.username.trim(), 350);
  useEffect(() => { if (u) get(`/api/auth/username/${encodeURIComponent(u)}`).then(setAvail).catch(() => {}); else setAvail(null); }, [u]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null); setErrs({});
    try {
      await post("/api/auth/register", f);
      await refresh();
      toast("Welcome to LORN.LOL", "ok");
      navigate("/dashboard");
    } catch (x) {
      const a = x as ApiError;
      setErrs(a.fieldErrors()); if (!Object.keys(a.fieldErrors()).length) setErr(a.message);
    } finally { setBusy(false); }
  };
  const set = (k: keyof typeof f) => (v: any) => setF((p) => ({ ...p, [k]: v }));
  return (
    <AuthFrame title="Create your page" sub={<>Already have one? <Link to="/login">Log in</Link></>}>
      <OAuthButtons />
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="reg-u">Username</label>
          <div className="input-affix"><span>lorn.lol/</span><input id="reg-u" className="input" value={f.username} onChange={(e) => set("username")(e.target.value.slice(0, 12))} maxLength={12} autoComplete="username" required /></div>
          {errs.username ? <span className="err">{errs.username}</span> : avail && <span className="hint" style={{ color: avail.available ? "var(--ok)" : "var(--bad)" }}>{avail.available ? "Available" : avail.reason}</span>}
        </div>
        <TextField label="Email" type="email" value={f.email} onChange={set("email")} error={errs.email} autoComplete="email" required />
        <TextField label="Password" type="password" value={f.password} onChange={set("password")} error={errs.password} hint="At least 8 characters" autoComplete="new-password" required />
        <label className="row small" style={{ alignItems: "flex-start" }}><input type="checkbox" checked={f.acceptTos} onChange={(e) => set("acceptTos")(e.target.checked)} style={{ marginTop: 3 }} /><span>I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link></span></label>
        {errs.acceptTos && <span className="err small">{errs.acceptTos}</span>}
        {err && <div className="banner bad small">{err}</div>}
        <Button kind="primary" busy={busy} type="submit" disabled={avail?.available === false}>Create account</Button>
      </form>
    </AuthFrame>
  );
}

export function TwoFactor() {
  const { refresh } = useSession();
  const { search } = useLocation();
  const [code, setCode] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await post("/api/auth/2fa/verify", { code });
      await refresh();
      const next = search.get("next") ?? "/dashboard";
      if (next.startsWith("/api/")) location.href = next; else navigate(next);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Two-factor check" sub="Enter the 6-digit code from your authenticator app, or one of your recovery codes.">
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <TextField label="Code" value={code} onChange={setCode} autoComplete="one-time-code" inputMode="numeric" autoFocus required />
        {err && <div className="banner bad small">{err}</div>}
        <Button kind="primary" busy={busy} type="submit">Verify</Button>
      </form>
    </AuthFrame>
  );
}

export function SignupComplete() {
  const { refresh } = useSession();
  const { search } = useLocation();
  const [p, setP] = useState<any>(null);
  const [name, setName] = useState(""); const [tos, setTos] = useState(false); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { get("/api/auth/signup/pending").then((r) => { setP(r); setName((r.suggestedUsername ?? "").replace(/[^A-Za-z0-9_.]/g, "").slice(0, 12)); }); }, []);
  if (p && !p.provider) return <AuthFrame title="Sign-up expired" sub="Start again from the login page."><Link className="btn primary" to="/login">Back to login</Link></AuthFrame>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await post("/api/auth/signup/complete", { username: name, acceptTos: tos });
      await refresh();
      const next = search.get("next");
      if (next === "/admin") location.href = "/api/auth/discord/start?intent=admin"; else navigate("/dashboard");
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Choose your username" sub={p ? `Signed in with ${p.provider === "discord" ? "Discord" : "Google"}. Pick the name for your page.` : undefined}>
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <div className="field"><label htmlFor="su-u">Username</label><div className="input-affix"><span>lorn.lol/</span><input id="su-u" className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} required /></div></div>
        <label className="row small"><input type="checkbox" checked={tos} onChange={(e) => setTos(e.target.checked)} /><span>I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link></span></label>
        {err && <div className="banner bad small">{err}</div>}
        <Button kind="primary" busy={busy} type="submit">Create account</Button>
      </form>
    </AuthFrame>
  );
}

export function ForgotPassword() {
  const [id, setId] = useState(""); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); try { await post("/api/auth/forgot-password", { identifier: id }); setSent(true); } catch (x) { toast((x as Error).message, "bad"); } finally { setBusy(false); } };
  return (
    <AuthFrame title="Reset your password" sub="We'll email you a link to set a new password.">
      {sent ? <div className="banner">If an account with that username or email exists, a reset link is on its way. It expires in an hour.</div> :
        <form className="col" style={{ gap: 14 }} onSubmit={submit}><TextField label="Username or email" value={id} onChange={setId} required /><Button kind="primary" busy={busy} type="submit">Send reset link</Button></form>}
      <div style={{ marginTop: 16 }}><Link to="/login" className="small">Back to login</Link></div>
    </AuthFrame>
  );
}

export function ResetPassword() {
  const { search } = useLocation();
  const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await post("/api/auth/reset-password", { token: search.get("token"), password: pw }); toast("Password updated. Log in with your new password.", "ok"); navigate("/login"); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Choose a new password" sub="This signs you out everywhere else.">
      <form className="col" style={{ gap: 14 }} onSubmit={submit}><TextField label="New password" type="password" value={pw} onChange={setPw} hint="At least 8 characters" autoComplete="new-password" required />{err && <div className="banner bad small">{err}</div>}<Button kind="primary" busy={busy} type="submit">Update password</Button></form>
    </AuthFrame>
  );
}

export function VerifyEmail() {
  const { search } = useLocation();
  const { refresh } = useSession();
  const [state, setState] = useState<"working" | "ok" | "bad">("working"); const [msg, setMsg] = useState("");
  useEffect(() => {
    post("/api/auth/verify-email", { token: search.get("token"), change: search.get("change") === "1" })
      .then(() => { setState("ok"); refresh(); }).catch((e) => { setState("bad"); setMsg(e.message); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthFrame title={state === "working" ? "Verifying…" : state === "ok" ? "Email verified" : "Couldn't verify"} sub={state === "bad" ? msg : state === "ok" ? "Thanks — your email is confirmed." : undefined}>
      {state !== "working" && <Link className="btn primary" to="/dashboard">Go to dashboard</Link>}
    </AuthFrame>
  );
}

export function Legal({ kind }: { kind: "terms" | "privacy" }) {
  return (
    <div className="auth-wrap app-bg">
      <article className="panel pad" style={{ maxWidth: 720 }}>
        <Brand />
        <h1 style={{ margin: "20px 0 12px" }}>{kind === "terms" ? "Terms of Service" : "Privacy Policy"}</h1>
        {kind === "terms" ? <div className="stack-16 muted">
          <p>By creating a LORN.LOL account you agree not to impersonate others, harass people, post illegal content or link to malware. We may hide profiles or suspend accounts that break these rules; decisions are recorded and can be appealed through support.</p>
          <p>You keep ownership of what you upload. You grant LORN.LOL a licence to store and display it on your profile. Delete it at any time from your media library.</p>
          <p>Paid features are delivered after payment is confirmed by our payment provider. Refunds are handled through support.</p>
          <p className="small dim">Replace this text with terms reviewed by your legal counsel before launch.</p>
        </div> : <div className="stack-16 muted">
          <p>We store your account details (username, email, password hash), your profile configuration and uploads, and security logs (sign-in history with IP address) to protect your account.</p>
          <p>Profile analytics never store visitor IP addresses: visitors are counted with a daily-rotating, salted hash that can't be linked across days. Bots are excluded.</p>
          <p>We don't sell personal data. Delete your account at any time from Account Settings; your username is released and your data is removed, while your numeric UID stays reserved.</p>
          <p className="small dim">Replace this text with a policy reviewed by your legal counsel before launch.</p>
        </div>}
      </article>
    </div>
  );
}

export function NotFound() {
  return <div className="lp-missing"><div><h1>Nothing here</h1><p>This page doesn't exist.</p><Link to="/">Go home</Link></div></div>;
}
