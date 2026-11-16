/** @jsxRuntime automatic @jsxImportSource react */
/** Landing, authentication and legal pages. */
import { useEffect, useMemo, useState , useRef } from "react";
import { SiDiscord, SiGoogle } from "react-icons/si";
import { LuAward, LuChartLine, LuChevronDown, LuCircleAlert, LuCircleCheck, LuEye, LuEyeOff, LuLayers, LuMenu, LuMusic, LuPalette, LuShieldCheck } from "react-icons/lu";
import { get, post, ApiError } from "../api.ts";
import { Link, navigate, useLocation } from "../router.tsx";
import { Button, TextField, toast, useDebounced } from "../ui.tsx";
import { useSession } from "../session.tsx";
import { ProfileView, type Payload } from "../../profile/ProfileView.tsx";
import { BADGE_GLYPHS } from "../../profile/icons.tsx";
import { defaultConfig } from "../../../shared/profile-schema.ts";

function Brand() { return <Link to="/" className="brand" style={{ padding: 0 }}><img className="mark" src="/static/brand/mark-128.png" alt="" />LORN.LOL</Link>; }

/** Looks the hero cycles through — each is a real config rendered by the production renderer. */
const LOOKS = [
  { key: "galaxy", label: "Galaxy", effect: "galaxy", colors: ["#1d4ed8", "#38bdf8", "#c4b5fd"], font: "Sora", nameEffect: "decrypt", overlay: "stars", accent: "#4f8cff" },
  { key: "aurora", label: "Aurora", effect: "aurora", colors: ["#0ea5e9", "#a78bfa", "#22d3ee"], font: "Syne", nameEffect: "wave", overlay: "floating", accent: "#a78bfa" },
  { key: "plasma", label: "Plasma", effect: "plasma", colors: ["#1e3a8a", "#6366f1", "#ec4899"], font: "Unbounded", nameEffect: "glitch", overlay: "particles", accent: "#ec4899" },
  { key: "rain", label: "Night rain", effect: "rain", colors: ["#0b1a3a", "#2563eb", "#93c5fd"], font: "Space Grotesk", nameEffect: "typewriter", overlay: "none", accent: "#93c5fd" },
] as const;

const BADGE_STRIP: [string, string, string][] = [
  ["flame", "OG", "#fb923c"], ["check", "Verified", "#3b82f6"], ["gem", "Premium", "#c084fc"], ["bug", "Bug Hunter", "#4ade80"],
  ["snowflake", "Christmas 2026", "#ef4444"], ["trophy", "Winner", "#facc15"], ["gift", "Gifter", "#f59e0b"], ["coins", "Donor", "#22c55e"],
  ["boost", "Server Booster", "#f472b6"], ["egg", "Easter 2027", "#fda4af"], ["bulb", "Helper", "#fbbf24"], ["party", "The Million", "#38bdf8"],
];

const EXAMPLE_NAMES = ["jay", "nova", "kai", "luna", "q5", "echo", "mira", "zed"];

function useDemoPayload(username: string, look: (typeof LOOKS)[number]): Payload {
  return useMemo(() => {
    const c = defaultConfig();
    c.identity.displayName = username || "you";
    c.identity.bio = "Your corner of the internet. Animated, yours, live in a minute.";
    c.identity.showUid = false; c.identity.showViews = false; c.identity.showJoined = false;
    c.background.effect = look.effect as any; c.background.effectColors = [...look.colors]; c.background.speed = .6;
    c.card.width = 360; c.card.tilt3d = true; c.card.glow = 30; c.card.bgOpacity = 40;
    c.typography.font = look.font as any; c.typography.nameEffect = look.nameEffect as any; c.typography.nameGradient = true;
    c.effects.overlay = look.overlay as any; c.effects.density = 20;
    c.links = (["discord", "github", "spotify", "x", "twitch"] as const).map((p, i) => ({ id: `demo${i}xx`, platform: p, url: "https://lorn.lol", title: "", description: "", iconAssetId: null, iconOnly: true, featured: false, visible: true, archived: false, color: null, hover: "lift", startAt: null, endAt: null }));
    c.widgets = [{ id: "democlock1", type: "clock", visible: true, span: 1, config: { timezone: "Europe/Berlin", hour12: false, seconds: true } }];
    return {
      user: { uid: 1, username: username || "you", createdAt: new Date().toISOString(), premium: false, verified: false }, config: c, assets: {}, views: 0, integrations: {}, mode: "draft",
      badges: [],
    };
  }, [username, look]);
}

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Types example names into the empty claim field, like someone trying them out. */
function useTypedPlaceholder(active: boolean) {
  const [text, setText] = useState("you");
  useEffect(() => {
    if (!active || reducedMotion()) { setText("you"); return; }
    let i = 0, pos = 0, dir = 1, t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = EXAMPLE_NAMES[i % EXAMPLE_NAMES.length];
      pos += dir;
      setText(word.slice(0, Math.max(pos, 0)) || "\u200b");
      if (dir > 0 && pos >= word.length) { dir = -1; t = setTimeout(tick, 1600); return; }
      if (dir < 0 && pos <= 0) { dir = 1; i++; t = setTimeout(tick, 350); return; }
      t = setTimeout(tick, dir > 0 ? 120 : 55);
    };
    t = setTimeout(tick, 900);
    return () => clearTimeout(t);
  }, [active]);
  return text;
}

/** Fade elements in once as they enter the viewport. */
function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    if (reducedMotion() || !("IntersectionObserver" in window)) return;
    // Only elements still below the fold get hidden, so nothing is ever stuck invisible.
    els.forEach((e) => { if (e.getBoundingClientRect().top > innerHeight) e.classList.add("pre"); });
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.remove("pre"); io.unobserve(en.target); } }), { threshold: 0.15 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

/** Live username check against the database. Stale answers are dropped, failures are shown, never swallowed. */
export function useUsernameCheck(raw: string) {
  const name = useDebounced(raw.trim(), 300);
  const [state, setState] = useState<{ name: string; status: "idle" | "checking" | "free" | "taken" | "error"; msg: string }>({ name: "", status: "idle", msg: "" });
  useEffect(() => {
    if (!name) { setState({ name: "", status: "idle", msg: "" }); return; }
    let live = true;
    setState({ name, status: "checking", msg: "Checking…" });
    get(`/api/auth/username/${encodeURIComponent(name)}`)
      .then((r) => { if (live) setState(r?.available === true ? { name, status: "free", msg: `lorn.lol/${name} is available` } : { name, status: "taken", msg: r?.reason || "This username is taken" }); })
      .catch((e) => { if (live) setState({ name, status: "error", msg: e?.message || "Couldn't check that name. Try again." }); });
    return () => { live = false; };
  }, [name]);
  // While the debounce or request is pending, the answer on screen belongs to an older value.
  const pending = raw.trim() !== state.name && !!raw.trim();
  return pending ? { name: raw.trim(), status: "checking" as const, msg: "Checking…" } : state;
}

function NameStatus({ c }: { c: ReturnType<typeof useUsernameCheck> }) {
  if (c.status === "idle") return null;
  const color = c.status === "free" ? "var(--ok)" : c.status === "checking" ? "var(--mist)" : "var(--bad)";
  return <span className="row name-status" style={{ color, gap: 6 }}>{c.status === "free" ? <LuCircleCheck /> : c.status === "checking" ? <i className="mini-spin" /> : <LuCircleAlert />}{c.msg}</span>;
}

/** Real platform totals. Nothing is shown until the database has something to count. */
function usePlatformStats() {
  const [s, setS] = useState<{ members: number; views: number; live: number } | null>(null);
  useEffect(() => { get("/api/public/stats").then((r) => { if (r && typeof r.members === "number") setS(r); }).catch(() => {}); }, []);
  return s;
}
const compact = (n: number) => new Intl.NumberFormat("en", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);

const money = (cents: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

const FAQ: [string, string][] = [
  ["What is LORN.LOL?", "A place to build one page that holds everything about you: links, music, badges, widgets and a look you design yourself. Your page lives at lorn.lol/yourname."],
  ["Is it really free?", "Yes. Links, widgets, effects, music players and the full editor are free with no card. Premium adds extras for people who want them."],
  ["What do visitors see before I've designed anything?", "A clean starter card with your name, join date, view count and UID. Your design replaces it the moment you publish."],
  ["How much can I change?", "Background effects or video, the card, fonts, cursor, entry screen, layout, pages and widgets. The preview next to the editor is the real renderer, so what you see is what goes live."],
  ["How do I sign in?", "With Discord, Google or email and password. On a browser we haven't seen, we email a 6-digit code after your password. You can connect Discord later in settings."],
  ["Is it safe?", "Passwords are hashed with Argon2, sessions end after two weeks of inactivity, and no custom code can run on a page. Analytics never store visitor IP addresses."],
];

export function Landing() {
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const nameCheck = useUsernameCheck(name);
  const check = nameCheck.status === "idle" ? "" : nameCheck.name;
  const stats = usePlatformStats();
  const [plans, setPlans] = useState<{ premium: { priceCents: number; currency: string; billing: string } | null } | null>(null);
  const [showcase, setShowcase] = useState<{ username: string; name: string; bio: string; views: number; colors: string[] }[]>([]);
  const [lookIdx, setLookIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [swap, setSwap] = useState(false);
  const [menu, setMenu] = useState(false);
  const { me } = useSession();
  useEffect(() => {
    get("/api/public/plans").then((r) => r && setPlans(r)).catch(() => {});
    get("/api/public/showcase").then((r) => Array.isArray(r?.profiles) && setShowcase(r.profiles)).catch(() => {});
  }, []);
  const goTo = (i: number) => {
    if (i === lookIdx) return;
    setSwap(true);
    setTimeout(() => { setLookIdx(i); setSwap(false); }, 320);
  };
  useEffect(() => {
    if (paused || reducedMotion()) return;
    const t = setTimeout(() => goTo((lookIdx + 1) % LOOKS.length), 6500);
    return () => clearTimeout(t);
  }, [lookIdx, paused]); // eslint-disable-line react-hooks/exhaustive-deps
  const look = LOOKS[lookIdx];
  const typed = useTypedPlaceholder(!name && !focused);
  const demo = useDemoPayload(check || (name ? "" : typed.replace("\u200b", "")), look);
  useReveal();
  const claim = () => navigate(`/register${name ? `?username=${encodeURIComponent(name.trim())}` : ""}`);
  const Glyph = (k: string) => { const I = BADGE_GLYPHS[k] ?? BADGE_GLYPHS.sparkles; return <I aria-hidden />; };
  const shownName = check || "you";
  const premium = plans?.premium;
  return (
    <div className="landing lx" style={{ ["--look" as any]: look.accent }}>
      <div className="lx-bg" aria-hidden><i /><i /><i /></div>
      <header className="lx-nav">
        <Brand />
        <nav className={menu ? "open" : ""} aria-label="Sections" onClick={() => setMenu(false)}>
          <a href="#features">Features</a><a href="#share">Sharing</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>
        </nav>
        <div className="row lx-nav-cta">
          {me?.user ? <Link className="btn primary pill" to="/dashboard">Open dashboard</Link> : <><Link className="btn ghost pill" to="/login">Login</Link><Link className="btn primary pill" to="/register">Get started</Link></>}
          <button className="btn icon pill lx-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><LuMenu /></button>
        </div>
      </header>

      <section className="lx-hero">
        <div className="lx-hero-copy">
          {stats && stats.members > 0 && <div className="live-pill"><i />{compact(stats.members)} {stats.members === 1 ? "page" : "pages"} claimed</div>}
          <h1>Not a template.<br />A page that's <em>yours</em>.</h1>
          <p className="lede">Build a profile that looks and sounds like you. Deeply customizable, quick to set up, and free.</p>
          <form className="lx-claim" onSubmit={(e) => { e.preventDefault(); claim(); }}>
            <span className="host">lorn.lol/</span>
            <span className="claim-field">
              <input value={name} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_.]/g, "").slice(0, 12))}
                placeholder={focused ? "yourname" : ""} aria-label="Choose your username" maxLength={12} autoComplete="off" spellCheck={false} />
              {!name && !focused && <span className="claim-ghost" aria-hidden>{typed}<i className="caret" /></span>}
            </span>
            <button className="btn primary pill" type="submit" disabled={nameCheck.status === "taken"}>Claim</button>
          </form>
          <div className="claim-status" aria-live="polite"><NameStatus c={nameCheck} /></div>
          <ul className="lx-ticks"><li><LuCircleCheck />Free forever</li><li><LuCircleCheck />No card required</li><li><LuCircleCheck />Live in a minute</li></ul>
        </div>
        <div className="lx-phone-wrap" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
          <div className="lx-phone">
            <span className="lx-island" aria-hidden />
            <div className={`hero-demo ${swap ? "swap" : ""}`} aria-label={`Live preview of a LORN.LOL profile, ${look.label} look`}><ProfileView payload={demo} mode="preview" /></div>
          </div>
          <div className="looks" role="tablist" aria-label="Example looks">
            {LOOKS.map((l, i) => (
              <button key={l.key} role="tab" aria-selected={i === lookIdx} className={i === lookIdx ? "on" : ""} style={{ ["--c" as any]: l.accent }} onClick={() => goTo(i)}>
                <span className="dot" />{l.label}{i === lookIdx && !paused && <span className="progress" key={lookIdx} />}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="badge-strip" aria-label="Badges you can earn">
        <div className="marquee"><div className="track">
          {[...BADGE_STRIP, ...BADGE_STRIP].map(([g, n, c], i) => <span key={i} className="strip-badge" style={{ ["--c" as any]: c }} aria-hidden={i >= BADGE_STRIP.length}>{Glyph(g)}{n}</span>)}
        </div></div>
      </section>

      <section className="lx-sec" id="features">
        <p className="lx-kicker">Everything in one editor</p>
        <h2>Change anything. See it instantly.</h2>
        <div className="lx-bento">
          <div className="glass b-wide" data-reveal><span className="ficon"><LuPalette aria-hidden /></span><h3>A real live editor</h3><p>Backgrounds, card, type, cursor and animations with undo, autosave and version history. The preview is the same renderer visitors get.</p>
            <div className="b-swatches" aria-hidden>{LOOKS.map((l) => <i key={l.key} style={{ background: `linear-gradient(135deg, ${l.colors.join(", ")})` }} />)}</div></div>
          <div className="glass" data-reveal><span className="ficon"><LuMusic aria-hidden /></span><h3>Music that plays</h3><p>Upload tracks, add timed lyrics and choose from seven player styles.</p></div>
          <div className="glass" data-reveal><span className="ficon"><LuLayers aria-hidden /></span><h3>Pages and widgets</h3><p>GitHub, Roblox, Steam, clocks, galleries and more, split across pages.</p></div>
          <div className="glass" data-reveal><span className="ficon"><LuAward aria-hidden /></span><h3>Badges that mean something</h3><p>Earn OG, event and milestone badges, or design your own.</p></div>
          <div className="glass" data-reveal><span className="ficon"><LuChartLine aria-hidden /></span><h3>Honest analytics</h3><p>Views, clicks and referrers from real visitors. Bots are filtered and IPs never stored.</p></div>
          <div className="glass b-wide" data-reveal><span className="ficon"><LuShieldCheck aria-hidden /></span><h3>Locked down by default</h3><p>Emailed sign-in codes on new browsers, automatic sign-out after two weeks away, Argon2 passwords, and no custom code on any page.</p></div>
        </div>
      </section>

      <section className="lx-sec lx-share" id="share">
        <div>
          <p className="lx-kicker">Made to be shared</p>
          <h2>One link for your bio, your server and your friends</h2>
          <p className="lede">Paste your link anywhere. It unfurls with your name, bio and banner, and opens to the page you designed.</p>
          <ol className="lx-steps">
            <li><b>Claim your name</b><span>Your starter card is public right away.</span></li>
            <li><b>Design it live</b><span>Nothing changes for visitors until you publish.</span></li>
            <li><b>Share the link</b><span>Every version is kept so you can roll back.</span></li>
          </ol>
        </div>
        <div className="glass lx-chat" aria-hidden data-reveal>
          <div className="msg"><span className="av" /><div><b>{shownName}</b><span className="dim"> just now</span><p>new page is up</p>
            <div className="embed"><span className="site">LORN.LOL</span><b>{shownName} (@{shownName})</b><span>Your corner of the internet.</span><i style={{ background: `linear-gradient(120deg, ${look.colors.join(", ")})` }} /><span className="url">lorn.lol/{shownName}</span></div>
          </div></div>
        </div>
      </section>

      <section className="lx-sec" id="pricing">
        <p className="lx-kicker">Free and Premium</p>
        <h2>Start free. Upgrade only if you want to.</h2>
        <div className="lx-plans">
          <div className="glass plan">
            <h3>Free</h3><div className="price"><b>{money(0, premium?.currency ?? "usd")}</b><span>forever</span></div>
            <ul><li><LuCircleCheck />Links, pages and widgets</li><li><LuCircleCheck />Background effects and animations</li><li><LuCircleCheck />Music players with lyrics</li><li><LuCircleCheck />Analytics and badges</li></ul>
            <Button size="lg" onClick={claim}>Create your profile</Button>
          </div>
          <div className="glass plan hot">
            <span className="chip">Premium</span>
            <h3>Premium</h3>
            {premium ? <div className="price"><b>{money(premium.priceCents, premium.currency)}</b><span>{premium.billing === "monthly" ? "per month" : "one-time"}</span></div> : <div className="price"><span>Price shown at checkout</span></div>}
            <ul><li><LuCircleCheck />Everything in Free</li><li><LuCircleCheck />Custom fonts and cursor images</li><li><LuCircleCheck />More pages and music tracks</li><li><LuCircleCheck />Bigger media storage and the Premium badge</li></ul>
            <Link className="btn primary lg" to={me?.user ? "/dashboard/premium" : "/register"}>Get Premium</Link>
          </div>
        </div>
      </section>

      <section className="lx-sec" id="faq">
        <p className="lx-kicker">Questions and answers</p>
        <h2>Good to know</h2>
        <div className="lx-faq">{FAQ.map(([q, a]) => <details key={q} className="glass"><summary>{q}<LuChevronDown aria-hidden /></summary><p>{a}</p></details>)}</div>
      </section>

      <section className="lx-final glass" data-reveal>
        <h2>Claim your username</h2>
        <p className="muted">Your name is one click away.</p>
        <div className="row" style={{ justifyContent: "center" }}><Button kind="primary" size="lg" onClick={claim}>Register for free</Button><a className="btn lg" href="#features">Explore features</a></div>
      </section>

      <footer className="lx-foot">
        <div><Brand /><p className="muted small">One page. Entirely yours.</p></div>
        <div><h4>Explore</h4><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div>
        <div><h4>Account</h4><Link to="/register">Sign up</Link><Link to="/login">Login</Link><Link to="/forgot-password">Reset password</Link></div>
        <div><h4>LORN.LOL</h4><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link></div>
        <p className="copy dim small">© {new Date().getFullYear()} LORN.LOL</p>
      </footer>
    </div>
  );
}

/** Right-hand stage of the auth screens: a real profile rendered live, never a screenshot. */
function AuthStage({ username, look = 0, caption }: { username: string; look?: number; caption: React.ReactNode }) {
  const stats = usePlatformStats();
  const demo = useDemoPayload(username, LOOKS[look % LOOKS.length]);
  return (
    <aside className="auth-stage" aria-hidden>
      <div className="auth-stage-frame"><div className="hero-demo"><ProfileView payload={demo} mode="preview" /></div></div>
      <div className="auth-stage-copy">
        <div className="url"><span>lorn.lol/</span>{username || "you"}</div>
        <p>{caption}</p>
        {stats && stats.members > 0 && <p className="dim small">{compact(stats.members)} {stats.members === 1 ? "member" : "members"} · {compact(stats.views)} profile views</p>}
      </div>
    </aside>
  );
}

function AuthFrame({ title, sub, children, stage }: { title: string; sub?: React.ReactNode; children: React.ReactNode; stage?: React.ReactNode }) {
  return (
    <div className={`auth-wrap app-bg ${stage ? "split" : ""}`}>
      <div className="auth-glow" aria-hidden />
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand"><Brand /></div>
          <h1>{title}</h1>{sub && <p className="muted auth-sub">{sub}</p>}
          {children}
        </div>
        <p className="auth-foot small dim"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/">Home</Link></p>
      </main>
      {stage}
    </div>
  );
}

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled.", oauth_state_mismatch: "That sign-in link expired or was opened in another browser. Try again.",
  oauth_state_expired: "That sign-in link expired. Try again.", oauth_exchange_failed: "The provider couldn't confirm your account. Try again.",
  account_banned: "This account is banned.", account_locked: "This account is locked. Contact support.", signup_disabled: "New sign-ups through this provider are paused.",
  oauth_invalid: "Sign-in failed. Try again.", login_disabled: "Login is temporarily disabled.",
  discord_not_configured: "Discord sign-in isn't switched on for this server yet. The site owner needs to add the Discord client ID and secret.",
  google_not_configured: "Google sign-in isn't switched on for this server yet.",
};

/** Discord is always offered; Google appears when the server has it set up. */
function OAuthButtons({ next, verb = "Continue" }: { next?: string; verb?: string }) {
  const [p, setP] = useState<{ discord: boolean; google: boolean } | null>(null);
  useEffect(() => { get("/api/auth/providers").then(setP).catch(() => {}); }, []);
  const q = next ? `&next=${encodeURIComponent(next)}` : "";
  return <>
    <div className="col oauth-col">
      <a className="btn oauth-btn discord" href={`/api/auth/discord/start?intent=login${q}`}><SiDiscord />{verb} with Discord</a>
      {p?.google && <a className="btn oauth-btn" href={`/api/auth/google/start?intent=login${q}`}><SiGoogle />{verb} with Google</a>}
    </div>
    <div className="or">or use email</div>
  </>;
}

function PasswordField({ label, value, onChange, error, autoComplete, meter }: { label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string; meter?: boolean }) {
  const [show, setShow] = useState(false);
  const id = `pw-${autoComplete}`;
  // Honest strength hint: length and variety only, no invented score.
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  const level = !value ? 0 : value.length < 8 ? 1 : value.length >= 14 && kinds >= 3 ? 4 : value.length >= 10 && kinds >= 2 ? 3 : 2;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-affix pw">
        <input id={id} className="input" type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
        <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide typed characters" : "Show typed characters"}>{show ? <LuEyeOff /> : <LuEye />}</button>
      </div>
      {meter && <div className={`pw-meter l${level}`} aria-hidden><i /><i /><i /><i /></div>}
      {error ? <span className="err">{error}</span> : meter && <span className="hint">{["At least 8 characters", "Too short — at least 8 characters", "Okay. Longer is stronger", "Good", "Strong"][level]}</span>}
    </div>
  );
}

export function Login() {
  const { refresh, me } = useSession();
  const { search } = useLocation();
  const [id, setId] = useState(""); const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(OAUTH_ERRORS[search.get("error") ?? ""] ?? null);
  const [busy, setBusy] = useState(false);
  const next = search.get("next") ?? "/dashboard";
  useEffect(() => { if (me?.user && !me.mfaPending) navigate(next.startsWith("/api/") ? "/dashboard" : next, true); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await post("/api/auth/login", { identifier: id.trim(), password: pw });
      await refresh();
      navigate(r.mfaRequired ? `/login/2fa?next=${encodeURIComponent(next)}` : next);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const typedName = /^[A-Za-z0-9_.]{1,12}$/.test(id.trim()) ? id.trim() : "";
  return (
    <AuthFrame title="Welcome back" sub={<>New here? <Link to="/register">Create your page</Link></>}
      stage={<AuthStage username={typedName} look={1} caption="Your page, your badges and your stats are right where you left them." />}>
      <OAuthButtons next={next} />
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <TextField label="Username or email" value={id} onChange={setId} autoComplete="username" required />
        <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="current-password" />
        {err && <div className="banner bad small" role="alert">{err}</div>}
        <Button kind="primary" size="lg" busy={busy} type="submit">Log in</Button>
        <Link to="/forgot-password" className="small">Forgot your password?</Link>
      </form>
    </AuthFrame>
  );
}

export function Register() {
  const { refresh } = useSession();
  const { search } = useLocation();
  const [f, setF] = useState({ username: (search.get("username") ?? "").replace(/[^A-Za-z0-9_.]/g, "").slice(0, 12), email: "", password: "", acceptTos: false });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const avail = useUsernameCheck(f.username);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null); setErrs({});
    try {
      const r = await post("/api/auth/register", f);
      await refresh();
      toast("Welcome to LORN.LOL", "ok");
      navigate(r?.verificationEmail === "pending" ? "/verify" : "/dashboard");
    } catch (x) {
      const a = x as ApiError;
      setErrs(a.fieldErrors()); if (!Object.keys(a.fieldErrors()).length) setErr(a.message);
    } finally { setBusy(false); }
  };
  const set = (k: keyof typeof f) => (v: any) => setF((p) => ({ ...p, [k]: v }));
  return (
    <AuthFrame title="Create your page" sub={<>Already have one? <Link to="/login">Log in</Link></>}
      stage={<AuthStage username={f.username} look={0} caption="Your page goes live the moment you sign up, then you make it yours in the editor." />}>
      <OAuthButtons verb="Sign up" />
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="reg-u">Username</label>
          <div className={`input-affix ${avail.status}`}><span>lorn.lol/</span><input id="reg-u" className="input" value={f.username} onChange={(e) => set("username")(e.target.value.replace(/[^A-Za-z0-9_.]/g, "").slice(0, 12))} maxLength={12} autoComplete="username" spellCheck={false} required /></div>
          {errs.username ? <span className="err">{errs.username}</span> : <NameStatus c={avail} />}
        </div>
        <TextField label="Email" type="email" value={f.email} onChange={set("email")} error={errs.email} autoComplete="email" required />
        <PasswordField label="Password" value={f.password} onChange={set("password")} error={errs.password} autoComplete="new-password" meter />
        <label className="row small" style={{ alignItems: "flex-start" }}><input type="checkbox" checked={f.acceptTos} onChange={(e) => set("acceptTos")(e.target.checked)} style={{ marginTop: 3 }} /><span>I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link></span></label>
        {errs.acceptTos && <span className="err small">{errs.acceptTos}</span>}
        {err && <div className="banner bad small" role="alert">{err}</div>}
        <Button kind="primary" size="lg" busy={busy} type="submit" disabled={avail.status === "taken"}>Create account</Button>
      </form>
    </AuthFrame>
  );
}

/** Six boxes that behave like one field: typing, backspace, arrows and pasting the whole code all work. */
function CodeInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (v: string, focus: number) => {
    const clean = v.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    refs.current[Math.min(focus, 5)]?.focus();
    if (clean.length === 6) onComplete?.(clean);
  };
  return (
    <div className="code-input" role="group" aria-label="6-digit code">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} value={value[i] ?? ""} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={6} autoFocus={i === 0} aria-label={`Digit ${i + 1}`}
          onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); if (d.length > 1) set(d, d.length); else set(value.slice(0, i) + d + value.slice(i + 1), d ? i + 1 : i); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) { e.preventDefault(); set(value.slice(0, i - 1), i - 1); }
            else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { e.preventDefault(); const d = e.clipboardData.getData("text").replace(/\D/g, ""); set(d, d.length); }}
          onFocus={(e) => e.target.select()} />
      ))}
    </div>
  );
}

function ResendCode({ path, onSent }: { path: string; onSent?: (r: any) => void }) {
  const [wait, setWait] = useState(30);
  const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const send = async () => {
    setNote(null);
    try {
      const r = await post(path);
      if (r?.status === "not_configured") setNote({ ok: false, t: "This server can't send email yet, so no code went out. The site owner needs to add the Resend key." });
      else { setNote({ ok: true, t: "New code sent. The old one no longer works." }); onSent?.(r); }
      setWait(30);
    } catch (x) { setNote({ ok: false, t: (x as Error).message }); }
  };
  return (
    <div className="resend small">
      {wait > 0 ? <span className="dim">Didn't get it? You can resend in {wait}s</span> : <button type="button" className="linklike" onClick={send}>Send a new code</button>}
      {note && <div className={`banner small ${note.ok ? "ok" : "bad"}`} role="status">{note.t}</div>}
    </div>
  );
}

/** Second step of sign-in: the code we emailed after a correct password on an unconfirmed browser. */
export function TwoFactor() {
  const { refresh, me, logout } = useSession();
  const { search } = useLocation();
  const [code, setCode] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (v = code) => {
    if (v.length < 6 || busy) return;
    setBusy(true); setErr(null);
    try {
      await post("/api/auth/2fa/verify", { code: v });
      await refresh();
      const next = search.get("next") ?? "/dashboard";
      if (next.startsWith("/api/")) location.href = next; else navigate(next);
    } catch (x) { setErr((x as Error).message); setCode(""); } finally { setBusy(false); }
  };
  useEffect(() => { if (me && !me.user) navigate("/login", true); else if (me?.user && !me.mfaPending) navigate(search.get("next") ?? "/dashboard", true); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthFrame title="Check your email" sub={<>We sent a 6-digit code to <b>{(me as any)?.emailHint ?? "your email"}</b>. Enter it to finish signing in.</>}>
      <form className="col" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <CodeInput value={code} onChange={setCode} onComplete={submit} />
        {err && <div className="banner bad small" role="alert">{err}</div>}
        <Button kind="primary" size="lg" busy={busy} type="submit" disabled={code.length < 6}>Finish signing in</Button>
        <ResendCode path="/api/auth/2fa/resend" />
        <button type="button" className="linklike small" onClick={async () => { await logout(); navigate("/login"); }}>Use a different account</button>
      </form>
      <p className="small dim" style={{ marginTop: 18 }}>We ask for a code on browsers we haven't confirmed, and again after two weeks away.</p>
    </AuthFrame>
  );
}

/** Last step of sign-up: confirm the email address with the code we just sent. */
export function VerifyCode() {
  const { refresh, me } = useSession();
  const [code, setCode] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (me && !me.user) navigate("/login", true); else if (me?.user?.emailVerified) navigate("/dashboard", true); }, [me]);
  const submit = async (v = code) => {
    if (v.length < 6 || busy) return;
    setBusy(true); setErr(null);
    try { await post("/api/auth/verify-email-code", { code: v }); await refresh(); toast("Email confirmed", "ok"); navigate("/dashboard"); }
    catch (x) { setErr((x as Error).message); setCode(""); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Confirm your email" sub={<>Your page is live. We sent a 6-digit code to <b>{me?.user?.email ?? "your email"}</b> so you can recover your account later.</>}
      stage={<AuthStage username={me?.user?.username ?? ""} look={2} caption="One more step and your account is fully protected." />}>
      <form className="col" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <CodeInput value={code} onChange={setCode} onComplete={submit} />
        {err && <div className="banner bad small" role="alert">{err}</div>}
        <Button kind="primary" size="lg" busy={busy} type="submit" disabled={code.length < 6}>Confirm email</Button>
        <ResendCode path="/api/auth/resend-verification" />
        <Link to="/dashboard" className="small">Do this later</Link>
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
  const suCheck = useUsernameCheck(name);
  if (p && !p.provider) return <AuthFrame title="Sign-up expired" sub="Start again from the login page."><Link className="btn primary" to="/login">Back to login</Link></AuthFrame>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await post("/api/auth/signup/complete", { username: name, acceptTos: tos });
      await refresh();
      const next = search.get("next");
      if (next === "/admin") location.href = "/api/auth/discord/start?intent=admin";
      else navigate(next && /^\/dashboard(\/|$)/.test(next) ? next : "/dashboard");
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Choose your username" sub={p ? `Signed in with ${p.provider === "discord" ? "Discord" : "Google"}. Pick the name for your page.` : undefined}>
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <div className="field"><label htmlFor="su-u">Username</label><div className="input-affix"><span>lorn.lol/</span><input id="su-u" className="input" value={name} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_.]/g, "").slice(0, 12))} required /></div><NameStatus c={suCheck} /></div>
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
