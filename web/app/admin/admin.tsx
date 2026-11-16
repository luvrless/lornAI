/** @jsxRuntime automatic @jsxImportSource react */
/** Admin control center. Navigation is filtered by the caller's permissions; every action is enforced server-side. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SiDiscord } from "react-icons/si";
import { LuLayoutDashboard, LuChartLine, LuActivity, LuUsers, LuSearch, LuBan, LuLock, LuTrash2, LuFlag, LuEyeOff, LuAward, LuTicket, LuHistory, LuSparkles, LuCalendarClock, LuTrophy, LuGem, LuRepeat, LuReceipt, LuCreditCard, LuRotateCcw, LuPackage, LuShieldCheck, LuKeyRound, LuMegaphone, LuToggleLeft, LuHardDrive, LuPlug, LuSettings, LuScrollText, LuMonitor, LuTriangleAlert, LuMenu, LuLogOut, LuArrowLeft } from "react-icons/lu";
import { get, post, ApiError } from "../api.ts";
import { Link, match, navigate, useLocation } from "../router.tsx";
import { useSession } from "../session.tsx";
import { NotFound } from "../pages/public.tsx";
import { Button, LoadingBlock } from "../ui.tsx";
import { Sidebar } from "../dashboard/shell.tsx";
import * as S from "./sections.tsx";

export interface Admin { role: "OWNER" | "ADMIN" | "STAFF"; discordId: string; uid: number; permissions: string[] }
const Ctx = createContext<Admin>(null!);
export const useAdmin = () => useContext(Ctx);
export const can = (a: Admin, ...p: string[]) => p.every((x) => a.permissions.includes(x));

type Item = [string, string, any, string[], () => ReactNode];
const SECTIONS: { group: string; items: Item[] }[] = [
  { group: "Overview", items: [
    ["/admin", "Dashboard", LuLayoutDashboard, [], () => <S.AdminDashboard />],
    ["/admin/analytics", "Analytics", LuChartLine, ["analytics.view"], () => <S.PlatformAnalytics />],
    ["/admin/system", "System health", LuActivity, ["settings.view"], () => <S.SystemHealth />],
  ] },
  { group: "User management", items: [
    ["/admin/users", "All users", LuUsers, ["users.search"], () => <S.UserList />],
    ["/admin/users/lookup", "User lookup", LuSearch, ["users.search"], () => <S.UserLookup />],
    ["/admin/users/banned", "Banned users", LuBan, ["users.search"], () => <S.UserList preset={{ banned: "true" }} title="Banned users" />],
    ["/admin/users/locked", "Locked accounts", LuLock, ["users.search"], () => <S.UserList preset={{ locked: "true" }} title="Locked accounts" />],
    ["/admin/users/deleted", "Deleted accounts", LuTrash2, ["users.search"], () => <S.UserList preset={{ status: "deleted" }} title="Deleted accounts" />],
  ] },
  { group: "Moderation", items: [
    ["/admin/moderation", "Reports", LuFlag, ["moderation.view"], () => <S.Reports />],
    ["/admin/moderation/actions", "Content moderation", LuEyeOff, ["moderation.view"], () => <S.ModerationLog />],
    ["/admin/moderation/custom-badges", "Custom badge review", LuSparkles, ["badges.review_custom"], () => <S.CustomBadgeReview />],
    ["/admin/support", "Support tickets", LuTicket, ["support.view"], () => <S.Tickets />],
  ] },
  { group: "Badges and events", items: [
    ["/admin/badges", "Badge manager", LuAward, ["badges.view"], () => <S.BadgeManager />],
    ["/admin/badges/assignments", "Badge assignments", LuHistory, ["badges.view"], () => <S.BadgeAssignments />],
    ["/admin/events", "Seasonal events", LuCalendarClock, ["badges.view"], () => <S.Events />],
    ["/admin/milestones", "Milestones", LuTrophy, ["badges.view"], () => <S.Milestones />],
  ] },
  { group: "Monetization", items: [
    ["/admin/monetization", "Premium subscribers", LuGem, ["premium.view"], () => <S.PremiumUsers />],
    ["/admin/monetization/subscriptions", "Subscriptions", LuRepeat, ["payments.view"], () => <S.Subscriptions />],
    ["/admin/monetization/purchases", "Purchases", LuReceipt, ["payments.view"], () => <S.Purchases />],
    ["/admin/monetization/transactions", "Transactions", LuCreditCard, ["payments.view"], () => <S.Transactions />],
    ["/admin/monetization/refunds", "Refunds", LuRotateCcw, ["payments.view"], () => <S.Refunds />],
    ["/admin/monetization/products", "Products and pricing", LuPackage, ["payments.view"], () => <S.Products />],
  ] },
  { group: "Staff management", items: [
    ["/admin/staff", "Staff members", LuShieldCheck, ["staff.view"], () => <S.StaffList role="STAFF" />],
    ["/admin/staff/admins", "Administrators", LuShieldCheck, ["admins.view"], () => <S.StaffList role="ADMIN" />],
    ["/admin/permissions", "Permission manager", LuKeyRound, ["staff.view"], () => <S.PermissionManager />],
    ["/admin/staff/activity", "Staff activity", LuHistory, ["audit.view"], () => <S.AuditLog preset="staff" />],
  ] },
  { group: "Platform", items: [
    ["/admin/announcements", "Announcements", LuMegaphone, ["announcements.manage"], () => <S.Announcements />],
    ["/admin/flags", "Feature flags", LuToggleLeft, ["settings.view"], () => <S.Flags />],
    ["/admin/storage", "Storage", LuHardDrive, ["storage.view"], () => <S.Storage />],
    ["/admin/integrations", "Integrations", LuPlug, ["settings.view"], () => <S.IntegrationsAdmin />],
    ["/admin/settings", "Platform settings", LuSettings, ["settings.view"], () => <S.Settings />],
  ] },
  { group: "Security", items: [
    ["/admin/audit", "Audit logs", LuScrollText, ["audit.view"], () => <S.AuditLog />],
    ["/admin/security/logins", "Login activity", LuActivity, ["security.view"], () => <S.LoginActivity />],
    ["/admin/security", "Security events", LuTriangleAlert, ["security.view"], () => <S.SecurityEvents />],
    ["/admin/security/sessions", "Admin sessions", LuMonitor, ["security.view"], () => <S.AdminSessions />],
  ] },
];

function Gate({ state }: { state: "signin" | "elevate" | "denied" | "unavailable" }) {
  const { search } = useLocation();
  return (
    <div className="auth-wrap app-bg">
      <div className="panel auth-card stack-16">
        <div className="brand" style={{ padding: 0 }}><img className="mark" src="/static/brand/mark-128.png" alt="" />LORN.LOL Admin</div>
        {state === "denied" ? <>
          <h1>No admin access</h1>
          <p className="muted">{search.get("reason") === "account_mismatch" ? "That Discord account is linked to a different LORN.LOL account." : "This Discord account isn't authorized for the admin panel."}</p>
          <Link className="btn" to="/dashboard">Back to dashboard</Link>
        </> : state === "unavailable" ? <>
          <h1>Admin sign-in unavailable</h1><p className="muted">Discord sign-in isn't configured on this server. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.</p>
        </> : <>
          <h1>{state === "signin" ? "Sign in to the admin panel" : "Confirm it's you"}</h1>
          <p className="muted">Admin access is tied to your Discord account and needs a fresh Discord sign-in every session.</p>
          <a className="btn primary lg" href="/api/auth/discord/start?intent=admin"><SiDiscord />Continue with Discord</a>
        </>}
      </div>
    </div>
  );
}

export function AdminApp() {
  const { pathname } = useLocation();
  const { me, loading, logout } = useSession();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [gate, setGate] = useState<"signin" | "elevate" | "denied" | "unavailable" | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (pathname === "/admin/denied") { setGate("denied"); return; }
    get<Admin>("/api/admin/whoami").then((a) => { setAdmin(a); setGate(null); }).catch(async (e: ApiError) => {
      const p = await get("/api/auth/providers").catch(() => ({ discord: false }));
      if (!p.discord) setGate("unavailable"); else setGate(e.status === 401 ? "signin" : "elevate");
    });
  }, [pathname === "/admin/denied"]); // eslint-disable-line react-hooks/exhaustive-deps
  // The panel doesn't reveal itself: signed-out visitors go to the normal login, and members who aren't
  // the owner or an owner-appointed admin get the same "nothing here" page as any unknown address.
  // (The server enforces access separately on every /api/admin request.)
  useEffect(() => { if (!loading && me && !me.user) navigate(`/login?next=${encodeURIComponent("/admin")}`, true); }, [loading, me]);
  if (loading || !me?.user) return <div className="boot" role="status" aria-label="Loading"><img src="/static/brand/mark-128.png" alt="" /><i /></div>;
  if (!admin && !me.adminPanel) return <NotFound />;
  if (gate) return <Gate state={gate} />;
  if (!admin) return <div className="auth-wrap"><LoadingBlock /></div>;
  const allowed = SECTIONS.map((g) => ({ group: g.group, items: g.items.filter((i) => can(admin, ...i[3])) })).filter((g) => g.items.length);
  const flat = allowed.flatMap((g) => g.items);
  const userDetail = match("/admin/users/:id", pathname);
  const exact = flat.find((i) => i[0] === pathname);
  let content: ReactNode;
  if (exact) content = exact[4]();
  else if (userDetail && /^[0-9a-f-]{36}$/.test(userDetail.id)) content = <S.UserDetail id={userDetail.id} />;
  else content = <div><h1>Not found</h1><p className="muted">This section doesn't exist or you don't have access to it.</p></div>;
  document.title = `${exact?.[1] ?? "Admin"} · LORN.LOL Admin`;
  return (
    <Ctx.Provider value={admin}>
      <div className="shell app-bg">
        <Sidebar nav={allowed.map((g) => ({ group: g.group, items: g.items.map(([a, b, c]) => [a, b, c] as [string, string, any]) }))} open={open} onNavigate={() => setOpen(false)} footer={
          <div className="col" style={{ gap: 4 }}>
            <Link className="nav-item" to="/dashboard"><LuArrowLeft />Back to dashboard</Link>
            <button className="nav-item" onClick={async () => { await post("/api/admin/session/end").catch(() => {}); navigate("/dashboard"); }}><LuLogOut />Leave admin</button>
            <div className="small dim" style={{ padding: "8px 10px" }}>{me?.user?.username} · <span className="chip" style={{ padding: "1px 7px" }}>{admin.role}</span></div>
          </div>
        } />
        <div style={{ minWidth: 0 }}>
          <div className="topbar-mobile"><button className="btn icon sm" onClick={() => setOpen(true)} aria-label="Open menu"><LuMenu /></button><b>Admin</b></div>
          {open && <div className="overlay" style={{ zIndex: 55, background: "rgba(0,0,0,.4)" }} onClick={() => setOpen(false)} />}
          <main className="main">{content}</main>
        </div>
      </div>
    </Ctx.Provider>
  );
  void logout;
}
