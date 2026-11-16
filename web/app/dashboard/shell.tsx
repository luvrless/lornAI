/** @jsxRuntime automatic @jsxImportSource react */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LuLayoutDashboard, LuUser, LuPalette, LuLink, LuLayers, LuLayoutTemplate, LuImage, LuMusic, LuAward, LuPlug, LuChartLine, LuShare2, LuSettings, LuLock, LuBell, LuGem, LuLifeBuoy, LuMenu, LuLogOut, LuShieldCheck, LuExternalLink, LuPuzzle, LuSearch } from "react-icons/lu";
import { Link, match, navigate, useLocation } from "../router.tsx";
import { useSession } from "../session.tsx";
import { useQuery } from "../ui.tsx";
import { Overview, Badges, Templates, Integrations, Analytics, Share, AccountSettings, Security, Notifications, Premium, Support } from "./pages.tsx";
import { Customize } from "./customize.tsx";
import { ProfileSettings, Links, Pages, Widgets, Music } from "./content.tsx";
import { MediaLibrary } from "./media.tsx";

const NAV: { group: string; items: [string, string, any][] }[] = [
  { group: "Your page", items: [
    ["/dashboard", "Overview", LuLayoutDashboard], ["/dashboard/profile", "Profile", LuUser], ["/dashboard/customize", "Customize", LuPalette],
    ["/dashboard/links", "Links", LuLink], ["/dashboard/pages", "Pages", LuLayers], ["/dashboard/widgets", "Widgets", LuPuzzle],
    ["/dashboard/music", "Music", LuMusic], ["/dashboard/media", "Media library", LuImage],
  ] },
  { group: "Grow", items: [
    ["/dashboard/analytics", "Analytics", LuChartLine], ["/dashboard/badges", "Badges", LuAward], ["/dashboard/templates", "Templates", LuLayoutTemplate],
    ["/dashboard/integrations", "Integrations", LuPlug], ["/dashboard/share", "Share", LuShare2],
  ] },
  { group: "Account", items: [
    ["/dashboard/account", "Account settings", LuSettings], ["/dashboard/security", "Security", LuLock], ["/dashboard/notifications", "Notifications", LuBell],
    ["/dashboard/premium", "Premium", LuGem], ["/dashboard/support", "Support", LuLifeBuoy],
  ] },
];
/** The four destinations people use most, pinned to the bottom of the screen on phones. */
const DOCK: [string, string, any][] = [["/dashboard", "Overview", LuLayoutDashboard], ["/dashboard/customize", "Customize", LuPalette], ["/dashboard/links", "Links", LuLink], ["/dashboard/analytics", "Analytics", LuChartLine]];

const ROUTES: Record<string, () => ReactNode> = {
  "/dashboard": () => <Overview />, "/dashboard/profile": () => <ProfileSettings />, "/dashboard/customize": () => <Customize />,
  "/dashboard/links": () => <Links />, "/dashboard/pages": () => <Pages />, "/dashboard/widgets": () => <Widgets />, "/dashboard/media": () => <MediaLibrary />,
  "/dashboard/music": () => <Music />, "/dashboard/badges": () => <Badges />, "/dashboard/templates": () => <Templates />, "/dashboard/integrations": () => <Integrations />,
  "/dashboard/analytics": () => <Analytics />, "/dashboard/share": () => <Share />, "/dashboard/account": () => <AccountSettings />, "/dashboard/security": () => <Security />,
  "/dashboard/notifications": () => <Notifications />, "/dashboard/premium": () => <Premium />, "/dashboard/support": () => <Support />,
};
const FLUSH = new Set(["/dashboard/profile", "/dashboard/customize", "/dashboard/links", "/dashboard/pages", "/dashboard/widgets", "/dashboard/music"]);

export function Sidebar({ nav, open, onNavigate, footer, badgeCounts = {} }: { nav: typeof NAV; open: boolean; onNavigate: () => void; footer: ReactNode; badgeCounts?: Record<string, number> }) {
  const { pathname } = useLocation();
  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation">
      <Link to="/" className="brand"><img className="mark" src="/static/brand/mark-128.png" alt="" />LORN.LOL</Link>
      {nav.map((g) => (
        <nav key={g.group} aria-label={g.group}>
          <div className="nav-group">{g.group}</div>
          {g.items.map(([to, label, Icon]) => (
            <Link key={to} to={to} className="nav-item" aria-current={pathname === to ? "page" : undefined} onClick={onNavigate}>
              <Icon />{label}{badgeCounts[to] ? <span className="count">{badgeCounts[to]}</span> : null}
            </Link>
          ))}
        </nav>
      ))}
      <div style={{ marginTop: "auto", paddingTop: 16 }}>{footer}</div>
    </aside>
  );
}

/** Jump to any screen by typing part of its name. Opens with Ctrl/⌘+K or the search button. */
function QuickJump({ nav, onClose }: { nav: typeof NAV; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const all = nav.flatMap((g) => g.items.map(([to, label, Icon]) => ({ to, label, Icon, group: g.group })));
  const hits = all.filter((x) => (x.label + " " + x.group).toLowerCase().includes(q.trim().toLowerCase()));
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <div className="overlay jump-overlay" onClick={onClose}>
      <div className="jump" role="dialog" aria-label="Jump to a screen" onClick={(e) => e.stopPropagation()}>
        <div className="jump-input"><LuSearch /><input autoFocus value={q} placeholder="Jump to…" aria-label="Search screens"
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(v + 1, hits.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
            else if (e.key === "Enter" && hits[i]) go(hits[i].to);
            else if (e.key === "Escape") onClose();
          }} /><kbd>Esc</kbd></div>
        <div className="jump-list" role="listbox">
          {hits.length ? hits.map((x, n) => (
            <button key={x.to} role="option" aria-selected={n === i} className={n === i ? "on" : ""} onMouseEnter={() => setI(n)} onClick={() => go(x.to)}><x.Icon /><span>{x.label}</span><em>{x.group}</em></button>
          )) : <p className="muted small" style={{ padding: 16 }}>No screen matches “{q}”.</p>}
        </div>
      </div>
    </div>
  );
}

export function DashboardShell() {
  const { me, loading, logout } = useSession();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [jump, setJump] = useState(false);
  const notes = useQuery<any[]>(me?.user ? "/api/account/notifications" : null);
  const status = useQuery<{ isPublished: boolean; hasUnpublishedChanges: boolean; moderationHidden: boolean }>(me?.user && !me.mfaPending ? "/api/profile/status" : null);
  // The header pill refreshes when the editor publishes, and when you leave an editing screen (drafts autosave there).
  const lastPath = useRef(pathname);
  useEffect(() => {
    const f = () => status.reload();
    window.addEventListener("lorn:profile-status", f);
    return () => window.removeEventListener("lorn:profile-status", f);
  }, [status.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (FLUSH.has(lastPath.current) && lastPath.current !== pathname) status.reload(); lastPath.current = pathname; }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  // Unread count: poll gently and on focus rather than on every navigation.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") notes.reload(); }, 60_000);
    const f = () => notes.reload();
    window.addEventListener("focus", f);
    return () => { clearInterval(t); window.removeEventListener("focus", f); };
  }, [notes.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pathname === "/dashboard/notifications") notes.reload(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setJump((v) => !v); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    if (loading) return;
    if (!me?.user) navigate(`/login?next=${encodeURIComponent(pathname)}`, true);
    else if (me.mfaPending) navigate(`/login/2fa?next=${encodeURIComponent(pathname)}`, true);
  }, [me, loading, pathname]);
  const current = NAV.flatMap((g) => g.items.map((it) => ({ group: g.group, to: it[0], label: it[1] }))).find((x) => x.to === pathname);
  useEffect(() => { document.title = `${current?.label ?? "Dashboard"} · LORN.LOL`; }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading && !me) return <div className="boot" role="status" aria-label="Loading"><img src="/static/brand/mark-128.png" alt="" /><i /></div>;
  if (!me?.user) return null;
  const route = Object.keys(ROUTES).find((r) => match(r, pathname));
  const unread = Array.isArray(notes.data) ? notes.data.filter((n) => !n.read_at).length : 0;
  const st = status.data;
  const pill = !st ? null : st.moderationHidden ? { c: "bad", t: "Hidden by moderators" } : !st.isPublished ? { c: "idle", t: "Starter card is public" } : st.hasUnpublishedChanges ? { c: "warn", t: "Unpublished changes" } : { c: "ok", t: "Live" };
  const name = me.user.displayName || me.user.username;
  const signOut = async () => { await logout(); navigate("/"); };
  return (
    <div className="shell app-bg">
      <Sidebar nav={NAV} open={open} onNavigate={() => setOpen(false)} badgeCounts={{ "/dashboard/notifications": unread }} footer={
        <div className="side-user">
          {me.adminPanel && <a className="nav-item" href="/admin"><LuShieldCheck />Admin panel</a>}
          <a className="nav-item" href={`/${me.user.username}`} target="_blank" rel="noreferrer"><LuExternalLink />View my page</a>
          <button className="nav-item" onClick={signOut}><LuLogOut />Log out</button>
          <div className="user-chip"><span className="avatar-dot" aria-hidden>{name.slice(0, 1).toUpperCase()}</span><span className="who"><b>{name}</b><span>@{me.user.username} · UID {me.user.uid}</span></span></div>
        </div>
      } />
      <div className="shell-main">
        <header className="topbar">
          <button className="btn icon sm only-mobile" onClick={() => setOpen(true)} aria-label="Open menu"><LuMenu /></button>
          <div className="crumbs"><span className="dim">{current?.group ?? "Dashboard"}</span><span className="sep" aria-hidden>/</span><b>{current?.label ?? "Not found"}</b></div>
          <div className="topbar-actions">
            {pill && <Link to="/dashboard/customize" className={`status-pill ${pill.c}`} title="Open the editor"><i />{pill.t}</Link>}
            <button className="btn sm jump-btn" onClick={() => setJump(true)} aria-label="Jump to a screen"><LuSearch /><span>Jump to…</span><kbd>Ctrl K</kbd></button>
            <a className="btn sm page-chip" href={`/${me.user.username}`} target="_blank" rel="noreferrer"><LuExternalLink /><span>lorn.lol/{me.user.username}</span></a>
            <Link to="/dashboard/notifications" className="btn icon sm bell" aria-label={unread ? `${unread} unread notifications` : "Notifications"}><LuBell />{unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}</Link>
          </div>
        </header>
        {open && <div className="overlay" style={{ zIndex: 55, background: "rgba(0,0,0,.5)" }} onClick={() => setOpen(false)} />}
        <main className={FLUSH.has(pathname) ? "flush" : "main"} id="main">{route ? ROUTES[route]() : <div className="main"><h1>Page not found</h1><Link to="/dashboard">Back to overview</Link></div>}</main>
        <nav className="dock" aria-label="Quick navigation">
          {DOCK.map(([to, label, Icon]) => <Link key={to} to={to} aria-current={pathname === to ? "page" : undefined}><Icon /><span>{label}</span></Link>)}
          <button onClick={() => setOpen(true)}><LuMenu /><span>More</span></button>
        </nav>
      </div>
      {jump && <QuickJump nav={NAV} onClose={() => setJump(false)} />}
    </div>
  );
}
