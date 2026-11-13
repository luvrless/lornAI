/** @jsxRuntime automatic @jsxImportSource react */
import { useEffect, useState, type ReactNode } from "react";
import { LuLayoutDashboard, LuUser, LuPalette, LuLink, LuLayers, LuLayoutTemplate, LuImage, LuMusic, LuAward, LuPlug, LuChartLine, LuShare2, LuSettings, LuLock, LuBell, LuGem, LuLifeBuoy, LuMenu, LuLogOut, LuShieldCheck, LuExternalLink, LuPuzzle } from "react-icons/lu";
import { Link, match, navigate, useLocation } from "../router.tsx";
import { useSession } from "../session.tsx";
import { useQuery } from "../ui.tsx";
import { Overview, Badges, Templates, Integrations, Analytics, Share, AccountSettings, Security, Notifications, Premium, Support } from "./pages.tsx";
import { Customize } from "./customize.tsx";
import { ProfileSettings, Links, Pages, Widgets, Music } from "./content.tsx";
import { MediaLibrary } from "./media.tsx";

const NAV: { group: string; items: [string, string, any][] }[] = [
  { group: "General", items: [
    ["/dashboard", "Overview", LuLayoutDashboard], ["/dashboard/profile", "Profile", LuUser], ["/dashboard/customize", "Customize", LuPalette],
    ["/dashboard/links", "Links", LuLink], ["/dashboard/pages", "Pages", LuLayers], ["/dashboard/widgets", "Widgets", LuPuzzle],
    ["/dashboard/media", "Media library", LuImage], ["/dashboard/music", "Music", LuMusic], ["/dashboard/badges", "Badges", LuAward],
    ["/dashboard/templates", "Templates", LuLayoutTemplate], ["/dashboard/integrations", "Integrations", LuPlug], ["/dashboard/analytics", "Analytics", LuChartLine], ["/dashboard/share", "Share", LuShare2],
  ] },
  { group: "Account", items: [
    ["/dashboard/account", "Account settings", LuSettings], ["/dashboard/security", "Security", LuLock], ["/dashboard/notifications", "Notifications", LuBell],
    ["/dashboard/premium", "Premium", LuGem], ["/dashboard/support", "Support", LuLifeBuoy],
  ] },
];

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
      <Link to="/" className="brand"><span className="mark" aria-hidden />LORN.LOL</Link>
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

export function DashboardShell() {
  const { me, loading, logout } = useSession();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const notes = useQuery<any[]>(me?.user ? "/api/account/notifications" : null);
  // Unread count: poll gently and on focus rather than on every navigation.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") notes.reload(); }, 60_000);
    const f = () => notes.reload();
    window.addEventListener("focus", f);
    return () => { clearInterval(t); window.removeEventListener("focus", f); };
  }, [notes.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pathname === "/dashboard/notifications") notes.reload(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loading) return;
    if (!me?.user) navigate(`/login?next=${encodeURIComponent(pathname)}`, true);
    else if (me.mfaPending) navigate(`/login/2fa?next=${encodeURIComponent(pathname)}`, true);
  }, [me, loading, pathname]);
  useEffect(() => { document.title = `${NAV.flatMap((g) => g.items).find(([to]) => to === pathname)?.[1] ?? "Dashboard"} · LORN.LOL`; }, [pathname]);
  if (!me?.user) return null;
  const route = Object.keys(ROUTES).find((r) => match(r, pathname));
  const unread = notes.data?.filter((n) => !n.read_at).length ?? 0;
  return (
    <div className="shell app-bg">
      <Sidebar nav={NAV} open={open} onNavigate={() => setOpen(false)} badgeCounts={{ "/dashboard/notifications": unread }} footer={
        <div className="col" style={{ gap: 4 }}>
          {me.adminPanel && <a className="nav-item" href="/admin"><LuShieldCheck />Admin panel</a>}
          <a className="nav-item" href={`/${me.user.username}`} target="_blank" rel="noreferrer"><LuExternalLink />View my page</a>
          <button className="nav-item" onClick={async () => { await logout(); navigate("/"); }}><LuLogOut />Log out</button>
          <div className="small dim" style={{ padding: "8px 10px" }}>@{me.user.username} · UID {me.user.uid}</div>
        </div>
      } />
      <div style={{ minWidth: 0 }}>
        <div className="topbar-mobile"><button className="btn icon sm" onClick={() => setOpen(true)} aria-label="Open menu"><LuMenu /></button><b>LORN.LOL</b></div>
        {open && <div className="overlay" style={{ zIndex: 55, background: "rgba(0,0,0,.4)" }} onClick={() => setOpen(false)} />}
        <main className={FLUSH.has(pathname) ? "" : "main"} id="main">{route ? ROUTES[route]() : <div className="main"><h1>Page not found</h1><Link to="/dashboard">Back to overview</Link></div>}</main>
      </div>
    </div>
  );
}
