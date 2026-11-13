/** @jsxRuntime automatic @jsxImportSource react */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LuSearch, LuDownload, LuPlus, LuPencil, LuTrash2, LuArchive, LuUsers, LuShieldCheck, LuRefreshCw, LuCircleCheck, LuCircleAlert, LuExternalLink, LuPlay } from "react-icons/lu";
import { get, post, put, patch, del, qs, fmtDate, fmtMoney, fmtBytes, ago, uploadFile } from "../api.ts";
import { Link, navigate } from "../router.tsx";
import { Button, Stat, LineChart, BarList, Empty, ErrorBlock, LoadingBlock, Modal, Select, Seg, Tabs, TextField, Toggle, ToggleRow, toast, useAction, useConfirm, useQuery, useDebounced, Pager, humanize, ColorField, Slider } from "../ui.tsx";
import { useAdmin, can } from "./admin.tsx";
import { BadgeIcon } from "../../profile/ProfileView.tsx";

const day = (d: string) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" });
const Head = ({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) => <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row wrap">{children}</div>}</div>;
function Q<T>({ q, children }: { q: { data: T | null; error: any; reload: () => void }; children: (d: T) => ReactNode }) {
  if (q.error) return <ErrorBlock error={q.error} retry={q.reload} />;
  if (!q.data) return <LoadingBlock rows={5} />;
  return <>{children(q.data)}</>;
}
const Table = ({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) => (
  <div className="panel"><div className="table-wrap"><table className="t"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}{empty && <tr><td colSpan={head.length} className="muted">Nothing here</td></tr>}</tbody></table></div></div>
);
const statusChip = (s: string) => <span className={`chip ${["paid", "active", "resolved", "completed", "assigned", "succeeded", "ok", "approved"].includes(s) ? "ok" : ["failed", "rejected", "refunded", "past_due", "canceled", "dead"].includes(s) ? "bad" : ["pending", "under_review", "running", "awaiting_staff", "escalated"].includes(s) ? "warn" : "dim"}`}>{humanize(s)}</span>;
/** Day-granular so the request URL is stable between renders (a ms timestamp here would refetch forever). */
const range = (days: string) => {
  const end = new Date(); end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end.getTime() - Number(days) * 86400_000 + 1);
  return { from: start.toISOString(), to: end.toISOString() };
};
const RangePick = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <Seg label="Date range" value={value} onChange={onChange} options={[{ value: "7", label: "7 d" }, { value: "30", label: "30 d" }, { value: "90", label: "90 d" }, { value: "365", label: "1 y" }]} />;

// ------------------------------------------------------------------ overview

export function AdminDashboard() {
  const [r, setR] = useState("30");
  const q = useQuery<any>(`/api/admin/dashboard${qs(range(r))}`);
  const a = useAdmin();
  return (
    <div className="stack-24">
      <Head title="Dashboard" sub="Live numbers from the database."><RangePick value={r} onChange={setR} /></Head>
      <Q q={q}>{(d) => <>
        {d.alerts.map((x: any, i: number) => <div key={i} className={`banner ${x.level === "critical" ? "bad" : "warn"} small`}><LuCircleAlert />{x.message}</div>)}
        <div className="grid-4">
          <Stat k="Registrations (all time)" v={d.platform.total_registrations.toLocaleString("en")} />
          <Stat k="Active users (30 d)" v={d.platform.active_users.toLocaleString("en")} />
          <Stat k="New today / week / month" v={`${d.platform.today} / ${d.platform.week} / ${d.platform.month}`} />
          <Stat k="Public profiles" v={d.platform.public_profiles.toLocaleString("en")} />
          <Stat k="Total profile views" v={Number(d.platform.total_views).toLocaleString("en")} />
          <Stat k="Pending reports" v={d.moderation.pending_reports} />
          <Stat k="Open tickets" v={d.moderation.pending_tickets} />
          <Stat k="Active bans / locks" v={`${d.moderation.active_bans} / ${d.moderation.locked_accounts}`} />
        </div>
        {d.monetization && <div className="grid-4">
          <Stat k="Premium users" v={d.monetization.premium_users} />
          <Stat k="Revenue in range" v={fmtMoney(Number(d.monetization.revenue_cents))} />
          <Stat k="Purchases in range" v={`${d.monetization.purchases} (${d.monetization.verified_purchases} verified, ${d.monetization.badge_pack_purchases} packs)`} />
          <Stat k="Failed payments / refunds" v={`${d.monetization.failed_payments} / ${fmtMoney(Number(d.monetization.refunded_cents))}`} />
        </div>}
        <div className="grid-2">
          <div className="panel"><div className="panel-head"><h3>Registrations</h3></div><div className="panel-body"><LineChart labels={d.charts.registrations.map((x: any) => day(x.day))} series={[{ name: "sign-ups", values: d.charts.registrations.map((x: any) => x.n) }]} /></div></div>
          <div className="panel"><div className="panel-head"><h3>Profile views</h3></div><div className="panel-body"><LineChart labels={d.charts.views.map((x: any) => day(x.day))} series={[{ name: "views", values: d.charts.views.map((x: any) => x.n) }]} /></div></div>
          {d.charts.revenue && <div className="panel"><div className="panel-head"><h3>Revenue</h3></div><div className="panel-body"><LineChart labels={d.charts.revenue.map((x: any) => day(x.day))} series={[{ name: "cents", values: d.charts.revenue.map((x: any) => Number(x.cents)) }]} /></div></div>}
          {d.charts.subscriptions && <div className="panel pad"><h3 style={{ marginBottom: 12 }}>Subscriptions by status</h3><BarList items={d.charts.subscriptions.map((s: any) => ({ name: humanize(s.status), n: s.n }))} /></div>}
        </div>
        <div className="grid-3">
          <div className="panel pad"><h3 style={{ marginBottom: 10 }}>Recent registrations</h3>{d.recent.registrations.map((u: any) => <div key={u.id} className="spread small" style={{ padding: "4px 0" }}><Link to={`/admin/users/${u.id}`}>{u.username}</Link><span className="dim">UID {u.uid} · {ago(u.created_at)}</span></div>)}</div>
          {d.recent.purchases && <div className="panel pad"><h3 style={{ marginBottom: 10 }}>Recent purchases</h3>{d.recent.purchases.map((p: any) => <div key={p.id} className="spread small" style={{ padding: "4px 0" }}><span>{p.username} · {humanize(p.product_key)}</span><span className="dim">{fmtMoney(p.amount_cents)} {statusChip(p.status)}</span></div>)}{!d.recent.purchases.length && <p className="muted small">None yet</p>}</div>}
          {d.recent.adminActions && <div className="panel pad"><h3 style={{ marginBottom: 10 }}>Recent admin actions</h3>{d.recent.adminActions.map((x: any, i: number) => <div key={i} className="spread small" style={{ padding: "4px 0" }}><span>{x.actor ?? "System"} · {humanize(x.action)}{x.target_username ? ` · ${x.target_username}` : ""}</span><span className="dim">{ago(x.at)}</span></div>)}</div>}
        </div>
        <div className="panel pad"><h3 style={{ marginBottom: 10 }}>Pending tasks</h3><div className="row wrap">
          {can(a, "moderation.view") && <Link className="btn sm" to="/admin/moderation">{d.moderation.pending_reports} reports to review</Link>}
          {can(a, "support.view") && <Link className="btn sm" to="/admin/support">{d.moderation.pending_tickets} tickets waiting</Link>}
          {can(a, "badges.review_custom") && <Link className="btn sm" to="/admin/moderation/custom-badges">{d.moderation.pending_custom_badges} custom badges to review</Link>}
        </div></div>
        <div className="panel pad"><h3 style={{ marginBottom: 10 }}>Infrastructure</h3><dl className="kv small">
          <dt>Database latency</dt><dd>{d.infra.dbLatencyMs} ms (pool {d.infra.pool.total} open, {d.infra.pool.waiting} waiting)</dd><dt>Storage</dt><dd>{fmtBytes(d.infra.storageBytes)} · {d.infra.storage}</dd>
          <dt>Background jobs (7 d)</dt><dd>{d.infra.jobs.map((j: any) => `${j.n} ${j.status}`).join(", ") || "none"}</dd><dt>Email outbox</dt><dd>{d.infra.emailOutbox.map((j: any) => `${j.n} ${humanize(j.status)}`).join(", ") || "empty"}</dd>
          <dt>Uptime</dt><dd>{Math.round(d.infra.uptimeSec / 60)} min · {d.infra.memoryMb} MB</dd></dl></div>
      </>}</Q>
    </div>
  );
}

export function PlatformAnalytics() {
  const [r, setR] = useState("30");
  const q = useQuery<any>(`/api/admin/analytics${qs(range(r))}`);
  return <div className="stack-24"><Head title="Platform analytics"><RangePick value={r} onChange={setR} /></Head><Q q={q}>{(d) => <>
    <div className="grid-3">{d.totals.map((t: any) => <Stat key={t.kind} k={humanize(t.kind) + "s"} v={`${t.n.toLocaleString("en")} (${t.uniques.toLocaleString("en")} unique)`} />)}</div>
    <div className="grid-3">
      <div className="panel pad"><h3 style={{ marginBottom: 12 }}>Most viewed profiles</h3><BarList items={d.topProfiles.map((p: any) => ({ name: `${p.username} (${p.uid})`, n: p.views }))} /></div>
      <div className="panel pad"><h3 style={{ marginBottom: 12 }}>Devices</h3><BarList items={d.devices} /></div>
      <div className="panel pad"><h3 style={{ marginBottom: 12 }}>Referrers</h3><BarList items={d.referrers} /></div>
    </div></>}</Q></div>;
}

export function SystemHealth() {
  const q = useQuery<any>("/api/admin/system");
  const a = useAdmin();
  const { run } = useAction();
  return <div className="stack-24"><Head title="System health"><Button size="sm" onClick={q.reload}><LuRefreshCw />Refresh</Button></Head><Q q={q}>{(d) => <>
    <Table head={["Component", "Status", "Detail"]}>
      {[...Object.entries(d.config), ["storage", d.storage], ["payments", d.payments], ["serverBooster", d.serverBooster]].map(([k, v]: any) => <tr key={k}><td><b>{humanize(k)}</b></td><td>{String(v).startsWith("not_configured") ? <span className="chip warn">Not configured</span> : <span className="chip ok">OK</span>}</td><td className="small muted">{String(v)}</td></tr>)}
      <tr><td><b>Node</b></td><td><span className="chip ok">OK</span></td><td className="small muted">{d.node} · up {Math.round(d.uptimeSec / 60)} min · pool {JSON.stringify(d.db.pool)}</td></tr>
    </Table>
    <h3>Background jobs (7 days)</h3>
    <Table head={["Kind", "Status", "Count", "Last error"]} empty={!d.jobs.length}>{d.jobs.map((j: any, i: number) => <tr key={i}><td>{j.kind}</td><td>{statusChip(j.status)}</td><td>{j.n}</td><td className="small muted">{j.last_error}</td></tr>)}</Table>
    {d.deadJobs.length > 0 && <><h3>Failed jobs</h3><Table head={["ID", "Kind", "Attempts", "Error", ""]}>{d.deadJobs.map((j: any) => <tr key={j.id}><td>{j.id}</td><td>{j.kind}</td><td>{j.attempts}</td><td className="small muted">{j.last_error}</td><td>{can(a, "settings.edit") && <Button size="sm" onClick={() => run(() => post(`/api/admin/system/jobs/${j.id}/retry`), "Job re-queued").then(q.reload)}>Retry</Button>}</td></tr>)}</Table></>}
    <h3>Integration calls (24 h)</h3>
    <Table head={["Provider", "OK", "Errors", "Last"]} empty={!d.integrations.last24h.length}>{d.integrations.last24h.map((r: any) => <tr key={r.provider}><td>{r.provider}</td><td>{r.ok}</td><td>{r.errors}</td><td>{ago(r.last)}</td></tr>)}</Table>
  </>}</Q></div>;
}

// ------------------------------------------------------------------ users

export function UserList({ preset = {}, title = "All users" }: { preset?: Record<string, string>; title?: string }) {
  const [f, setF] = useState<Record<string, string>>({ q: "", premium: "", verified: "", role: "", badge: "", sort: "-uid", ...preset });
  const [offset, setOffset] = useState(0);
  const term = useDebounced(f.q, 300);
  const params = { ...f, q: term, limit: 25, offset };
  const q = useQuery<any>(`/api/admin/users${qs(params)}`);
  useEffect(() => setOffset(0), [term, f.premium, f.verified, f.role, f.badge, f.sort]);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="stack-24">
      <Head title={title} sub="Search by username, UID, email or Discord ID." />
      <div className="row wrap">
        <div className="input-affix" style={{ width: 300 }}><span><LuSearch /></span><input className="input" value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="Username, UID, email, Discord ID" aria-label="Search users" /></div>
        <Select label="Premium" value={f.premium} onChange={set("premium")} options={[{ value: "", label: "Any plan" }, { value: "true", label: "Premium" }, { value: "false", label: "Free" }]} />
        <Select label="Verified" value={f.verified} onChange={set("verified")} options={[{ value: "", label: "Any verification" }, { value: "true", label: "Verified" }, { value: "false", label: "Not verified" }]} />
        <Select label="Role" value={f.role} onChange={set("role")} options={[{ value: "", label: "Any role" }, { value: "OWNER", label: "Owner" }, { value: "ADMIN", label: "Admin" }, { value: "STAFF", label: "Staff" }]} />
        <input className="input" style={{ width: 150 }} value={f.badge} onChange={(e) => set("badge")(e.target.value)} placeholder="Badge key" aria-label="Owns badge" />
        <Select label="Sort" value={f.sort} onChange={set("sort")} options={[{ value: "-uid", label: "Newest" }, { value: "uid", label: "Oldest" }, { value: "username", label: "Username" }, { value: "last_login", label: "Last login" }]} />
      </div>
      <Q q={q}>{(d) => <div className="panel">
        <div className="table-wrap"><table className="t"><thead><tr><th>UID</th><th>User</th><th>Email</th><th>Joined</th><th>Last login</th><th>Status</th></tr></thead><tbody>
          {d.items.map((u: any) => <tr key={u.id} className="click" onClick={() => navigate(`/admin/users/${u.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/admin/users/${u.id}`)}>
            <td className="mono">{u.uid}</td><td><b>{u.username}</b> {u.staff_role && <span className="chip">{u.staff_role}</span>}</td><td className="small">{u.email ?? <span className="dim">hidden</span>}</td>
            <td className="small">{fmtDate(u.created_at)}</td><td className="small">{u.last_login_at ? ago(u.last_login_at) : "—"}</td>
            <td><div className="chips">{u.status === "deleted" && <span className="chip dim">Deleted</span>}{u.banned && <span className="chip bad">Banned</span>}{u.locked && <span className="chip warn">Locked</span>}{u.premium && <span className="chip">Premium</span>}{u.verified && <span className="chip ok">Verified</span>}</div></td></tr>)}
          {!d.items.length && <tr><td colSpan={6}><Empty icon={<LuUsers />} title="No users match" /></td></tr>}
        </tbody></table></div>
        <Pager total={d.total} limit={25} offset={offset} onChange={setOffset} />
      </div>}</Q>
    </div>
  );
}

export function UserLookup() {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { const r = await get(`/api/admin/users${qs({ q: v.trim(), limit: 2 })}`); if (r.items.length === 1 || (r.items[0] && (String(r.items[0].uid) === v.trim() || r.items[0].username.toLowerCase() === v.trim().toLowerCase()))) navigate(`/admin/users/${r.items[0].id}`); else toast(r.items.length ? "Several matches — use All users to pick one" : "No user found", "bad"); }
    catch (x) { toast((x as Error).message, "bad"); } finally { setBusy(false); }
  };
  return <div className="stack-24" style={{ maxWidth: 560 }}><Head title="User lookup" sub="Jump straight to an account by exact username, UID, email or Discord ID." />
    <form className="row" onSubmit={go}><input className="input" value={v} onChange={(e) => setV(e.target.value)} autoFocus aria-label="Lookup" /><Button kind="primary" busy={busy} type="submit">Open</Button></form></div>;
}

export function UserDetail({ id }: { id: string }) {
  const q = useQuery<any>(`/api/admin/users/${id}`);
  const audit = useQuery<any[]>(can(useAdmin(), "audit.view") ? `/api/admin/users/${id}/audit` : null);
  const badges = useQuery<any[]>("/api/admin/badges");
  const a = useAdmin();
  const confirm = useConfirm();
  const { busy, run } = useAction();
  const [tab, setTab] = useState<"account" | "profile" | "purchases" | "security" | "moderation" | "audit">("account");
  const [modal, setModal] = useState<null | "username" | "email" | "ban" | "note" | "badge" | "premium" | "credits">(null);
  const [val, setVal] = useState(""); const [val2, setVal2] = useState("");
  const act = async (path: string, body: object, title: string, msg: string, danger = false, extra: { typeToConfirm?: string } = {}) => {
    const ok = await confirm({ title, reason: true, danger, confirm: title, ...extra });
    if (!ok) return;
    const r = await run(() => post(`/api/admin/users/${id}/${path}`, { ...body, reason: ok.reason, confirmUsername: extra.typeToConfirm }), msg);
    if (r !== undefined || true) { q.reload(); audit.reload(); }
  };
  return <Q q={q}>{(d) => {
    const u = d.account;
    const banned = d.security.bans.find((b: any) => !b.lifted_at && (!b.expires_at || new Date(b.expires_at) > new Date()));
    const locked = d.security.locks.find((l: any) => !l.unlocked_at);
    const hasPremium = d.entitlements.some((e: any) => e.kind === "premium");
    const hasVerified = d.entitlements.some((e: any) => e.kind === "verified");
    return <div className="stack-24">
      <Head title={u.username} sub={<>UID {u.uid} · joined {fmtDate(u.createdAt)} {u.role && <span className="chip">{u.role}</span>} {u.status === "deleted" && <span className="chip dim">Deleted</span>} {banned && <span className="chip bad">Banned</span>} {locked && <span className="chip warn">Locked</span>}</>}>
        {u.status !== "deleted" && <a className="btn sm" href={d.profile.url} target="_blank" rel="noreferrer"><LuExternalLink />Profile</a>}
      </Head>
      {u.status !== "deleted" && <div className="panel pad"><div className="row wrap">
        {can(a, "users.edit_username") && <Button size="sm" onClick={() => { setVal(u.username); setModal("username"); }}>Change username</Button>}
        {can(a, "users.change_email") && <Button size="sm" onClick={() => { setVal(u.email ?? ""); setModal("email"); }}>Change email</Button>}
        {can(a, "users.recover_password") && u.email && <Button size="sm" onClick={() => act("recover", {}, "Send password recovery", "Recovery email queued")}>Send password recovery</Button>}
        {can(a, "sessions.manage") && <Button size="sm" onClick={() => act("sessions/revoke", {}, "Sign out everywhere", "Sessions revoked")}>Revoke sessions</Button>}
        {locked ? can(a, "users.unlock") && <Button size="sm" onClick={() => act("unlock", {}, "Unlock account", "Account unlocked")}>Unlock</Button> : can(a, "users.lock") && <Button size="sm" onClick={() => act("lock", {}, "Lock account", "Account locked", true)}>Lock</Button>}
        {banned ? can(a, "users.unban") && <Button size="sm" onClick={() => act("unban", {}, "Lift ban", "Ban lifted")}>Lift ban</Button> : (can(a, "users.ban_temporary") || can(a, "users.ban_permanent")) && <Button size="sm" kind="danger" onClick={() => { setVal("7"); setModal("ban"); }}>Ban</Button>}
        {can(a, "moderation.warn") && <Button size="sm" onClick={() => act("warn", {}, "Issue a warning", "Warning sent")}>Warn</Button>}
        {can(a, "moderation.ban") && <Button size="sm" onClick={() => act("profile-visibility", { hidden: !d.profile.hidden }, d.profile.hidden ? "Restore profile" : "Hide profile", d.profile.hidden ? "Profile restored" : "Profile hidden", !d.profile.hidden)}>{d.profile.hidden ? "Restore profile" : "Hide profile"}</Button>}
        {can(a, "users.flag") && <Button size="sm" onClick={() => act("flag", {}, "Flag as suspicious", "Account flagged")}>Flag</Button>}
        {can(a, "users.notes") && <Button size="sm" onClick={() => { setVal(""); setModal("note"); }}>Add note</Button>}
        {can(a, "badges.assign") && <Button size="sm" onClick={() => { setVal(""); setModal("badge"); }}>Assign badge</Button>}
        {hasPremium ? can(a, "premium.revoke") && <Button size="sm" onClick={async () => { const ok = await confirm({ title: "Revoke Premium", reason: true, danger: true }); if (ok) run(() => del(`/api/admin/users/${id}/premium`, { reason: ok.reason }), "Premium revoked").then(q.reload); }}>Revoke Premium</Button> : can(a, "premium.grant") && <Button size="sm" onClick={() => { setVal(""); setModal("premium"); }}>Grant Premium</Button>}
        {can(a, "badges.assign_restricted") && (hasVerified ? <Button size="sm" onClick={async () => { const ok = await confirm({ title: "Remove Verified", reason: true, danger: true }); if (ok) run(() => del(`/api/admin/users/${id}/verified`, { reason: ok.reason }), "Verified removed").then(q.reload); }}>Remove Verified</Button> : <Button size="sm" onClick={() => act("verified", {}, "Grant Verified", "Verified granted")}>Grant Verified</Button>)}
        {can(a, "premium.grant") && <Button size="sm" onClick={() => { setVal("1"); setModal("credits"); }}>Adjust badge credits</Button>}
        {can(a, "users.delete") && <Button size="sm" kind="danger" onClick={() => act("delete", {}, "Delete account", "Account deleted", true, { typeToConfirm: u.username })}>Delete account</Button>}
      </div></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "account", label: "Account" }, { value: "profile", label: "Profile" }, { value: "purchases", label: "Purchases" }, { value: "security", label: "Security" }, { value: "moderation", label: "Moderation" }, ...(audit.data ? [{ value: "audit" as const, label: "Audit history" }] : [])]} />
      {tab === "account" && <div className="grid-2">
        <div className="panel pad"><dl className="kv small">
          <dt>UID</dt><dd>{u.uid}</dd><dt>Username</dt><dd>{u.username}</dd><dt>Display name</dt><dd>{u.displayName ?? "—"}</dd>
          <dt>Email</dt><dd>{u.email ?? (can(a, "users.view_email") ? "None" : "Hidden")} {u.email && (u.emailVerified ? <span className="chip ok">Verified</span> : <span className="chip warn">Unverified</span>)}</dd>
          <dt>Discord ID</dt><dd className="mono">{u.discordId ?? "Not linked"}</dd><dt>Two-factor</dt><dd>{u.twoFactor ? "On" : "Off"}</dd>
          <dt>Registered</dt><dd>{fmtDate(u.createdAt, true)}</dd><dt>Last login</dt><dd>{fmtDate(u.lastLoginAt, true)}</dd><dt>Status</dt><dd>{humanize(u.status)}</dd>
        </dl></div>
        <div className="panel pad stack-16">
          <h3>Badges</h3>
          <div className="col">{d.badges.map((b: any) => <div key={b.id} className="spread small"><span>{b.name} <span className="dim">· {humanize(b.method)} {fmtDate(b.acquired_at)}</span></span>{can(a, "badges.revoke") && <Button size="sm" kind="ghost" onClick={async () => { const ok = await confirm({ title: `Revoke ${b.name}`, reason: true, danger: true }); if (ok) run(() => del(`/api/admin/users/${id}/badges/${b.id}`, { reason: ok.reason }), "Badge revoked").then(q.reload); }}>Revoke</Button>}</div>)}{!d.badges.length && <span className="muted small">No badges</span>}</div>
          <h3>Entitlements</h3>
          <div className="col small">{d.entitlements.map((e: any) => <div key={e.id}>{humanize(e.kind)} · {e.source === "admin_grant" ? "granted by staff" : humanize(e.source)} · {e.expires_at ? `until ${fmtDate(e.expires_at)}` : "no expiry"}</div>)}{!d.entitlements.length && <span className="muted">None</span>}</div>
          <h3>Connections</h3>
          <div className="small">{d.connections.map((c: any) => <div key={c.provider}>{humanize(c.provider)} · {c.provider_username} <span className="mono dim">{c.provider_user_id}</span></div>)}{!d.connections.length && <span className="muted">None</span>}</div>
          <h3>Username history</h3>
          <div className="small">{d.usernameHistory.map((h: any, i: number) => <div key={i}>{h.old_username ?? "—"} → {h.new_username} <span className="dim">{fmtDate(h.changed_at)} · {h.reason}</span></div>)}</div>
        </div>
      </div>}
      {tab === "profile" && <div className="panel pad"><dl className="kv small">
        <dt>Public URL</dt><dd><a href={d.profile.url} target="_blank" rel="noreferrer">{d.profile.url}</a></dd><dt>Published</dt><dd>{d.profile.published ? `Yes, ${fmtDate(d.profile.publishedAt, true)}` : "No"}</dd>
        <dt>Visibility</dt><dd>{d.profile.visibility ?? "—"} {d.profile.hidden && <span className="chip bad">Hidden: {d.profile.hiddenReason}</span>}</dd>
        <dt>Views / clicks</dt><dd>{d.profile.views} / {d.profile.totals.clicks}</dd><dt>Background</dt><dd>{d.profile.background ? `${d.profile.background.type}${d.profile.background.type === "effect" ? ` (${d.profile.background.effect})` : ""}` : "—"}</dd>
        <dt>Media</dt><dd>{d.profile.media.files} files, {fmtBytes(Number(d.profile.media.bytes))}</dd><dt>Music tracks</dt><dd>{d.profile.musicTracks}</dd>
        <dt>Widgets</dt><dd>{d.profile.widgets.join(", ") || "None"}</dd>
        <dt>Social links</dt><dd>{d.profile.links.map((l: any, i: number) => <div key={i}>{humanize(l.platform)}: <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.url}</a></div>)}{!d.profile.links.length && "None"}</dd>
      </dl></div>}
      {tab === "purchases" && (d.purchases ? <Table head={["Product", "Amount", "Status", "Created", "Paid", "Refunds"]} empty={!d.purchases.length}>{d.purchases.map((p: any) => <tr key={p.id}><td>{humanize(p.product_key)}</td><td>{fmtMoney(p.amount_cents, p.currency)}</td><td>{statusChip(p.status)}</td><td>{fmtDate(p.created_at)}</td><td>{fmtDate(p.paid_at)}</td><td>{p.refunds?.map((r: any) => fmtMoney(r.amount_cents)).join(", ") ?? "—"}</td></tr>)}</Table> : <p className="muted">You don't have permission to view payments.</p>)}
      {tab === "security" && <div className="stack-16">
        <h3>Active sessions</h3><Table head={["Method", "IP", "Device", "Last seen"]} empty={!d.security.sessions.length}>{d.security.sessions.map((s: any) => <tr key={s.id}><td>{s.auth_method}</td><td className="mono">{s.ip}</td><td className="small">{s.user_agent?.slice(0, 60)}</td><td>{ago(s.last_seen_at)}</td></tr>)}</Table>
        <h3>Login history</h3><Table head={["When", "Result", "Method", "IP"]} empty={!d.security.logins.length}>{d.security.logins.map((l: any, i: number) => <tr key={i}><td>{fmtDate(l.at, true)}</td><td>{l.success ? <span className="chip ok">OK</span> : <span className="chip bad">{l.failure_reason}</span>} {l.suspicious && <span className="chip warn">New device</span>}</td><td>{l.method}</td><td className="mono">{l.ip}</td></tr>)}</Table>
        <h3>Bans</h3><Table head={["When", "By", "Reason", "Until", "Lifted"]} empty={!d.security.bans.length}>{d.security.bans.map((b: any) => <tr key={b.id}><td>{fmtDate(b.banned_at, true)}</td><td>{b.by}</td><td>{b.reason}</td><td>{b.expires_at ? fmtDate(b.expires_at, true) : "Permanent"}</td><td>{b.lifted_at ? `${fmtDate(b.lifted_at)} — ${b.lift_reason}` : "—"}</td></tr>)}</Table>
        <h3>Locks</h3><Table head={["When", "By", "Reason", "Unlocked"]} empty={!d.security.locks.length}>{d.security.locks.map((l: any) => <tr key={l.id}><td>{fmtDate(l.locked_at, true)}</td><td>{l.by}</td><td>{l.reason}</td><td>{fmtDate(l.unlocked_at, true)}</td></tr>)}</Table>
        <h3>Password recovery</h3><Table head={["Requested", "By staff", "Used", "Expires"]} empty={!d.security.passwordRecoveries.length}>{d.security.passwordRecoveries.map((r: any, i: number) => <tr key={i}><td>{fmtDate(r.created_at, true)}</td><td>{r.by_staff ? "Yes" : "No"}</td><td>{fmtDate(r.used_at, true)}</td><td>{fmtDate(r.expires_at, true)}</td></tr>)}</Table>
        <h3>Security events</h3><Table head={["When", "Event", "Severity", "IP"]} empty={!d.security.events.length}>{d.security.events.map((e: any, i: number) => <tr key={i}><td>{fmtDate(e.at, true)}</td><td>{humanize(e.kind)}</td><td>{statusChip(e.severity === "warning" ? "pending" : e.severity === "critical" ? "failed" : "ok")}</td><td className="mono">{e.ip}</td></tr>)}</Table>
      </div>}
      {tab === "moderation" && <div className="stack-16">
        {d.moderation.notes && <><h3>Internal notes</h3>{d.moderation.notes.map((n: any) => <div key={n.id} className="inset" style={{ padding: 10 }}><div className="small dim">{n.author} · {fmtDate(n.at, true)}</div><p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p></div>)}{!d.moderation.notes.length && <p className="muted small">No notes</p>}</>}
        <h3>Moderation history</h3><Table head={["When", "Moderator", "Action", "Reason", "Status"]} empty={!d.moderation.actions.length}>{d.moderation.actions.map((m: any, i: number) => <tr key={i}><td>{fmtDate(m.at, true)}</td><td>{m.moderator}</td><td>{humanize(m.action)}</td><td>{m.reason}</td><td className="small">{m.previous_status ?? "—"} → {m.new_status ?? "—"}</td></tr>)}</Table>
        <h3>Warnings</h3><Table head={["When", "By", "Reason"]} empty={!d.moderation.warnings.length}>{d.moderation.warnings.map((w: any, i: number) => <tr key={i}><td>{fmtDate(w.at, true)}</td><td>{w.by}</td><td>{w.reason}</td></tr>)}</Table>
        <h3>Flags</h3><Table head={["When", "By", "Reason", "Cleared"]} empty={!d.moderation.flags.length}>{d.moderation.flags.map((f: any, i: number) => <tr key={i}><td>{fmtDate(f.at, true)}</td><td>{f.by}</td><td>{f.reason}</td><td>{f.cleared_at ? fmtDate(f.cleared_at) : can(a, "users.flag") ? <Button size="sm" onClick={() => run(() => post(`/api/admin/users/${id}/flag`, { clear: true, reason: "cleared" }), "Flag cleared").then(q.reload)}>Clear</Button> : "—"}</td></tr>)}</Table>
        <h3>Reports against this user</h3><Table head={["When", "Category", "Status"]} empty={!d.moderation.reports.length}>{d.moderation.reports.map((r: any) => <tr key={r.id}><td>{fmtDate(r.created_at)}</td><td>{humanize(r.category)}</td><td>{statusChip(r.status)}</td></tr>)}</Table>
      </div>}
      {tab === "audit" && audit.data && <Table head={["When", "Actor", "Action", "Reason", "Change"]} empty={!audit.data.length}>{audit.data.map((x: any) => <tr key={x.id}><td>{fmtDate(x.at, true)}</td><td>{x.actor ?? "System"}</td><td>{x.action}</td><td>{x.reason}</td><td className="mono small">{x.new_state ? JSON.stringify(x.new_state).slice(0, 80) : ""}</td></tr>)}</Table>}

      {modal === "username" && <ActionModal title="Change username" busy={busy} onClose={() => setModal(null)} onSubmit={(reason) => run(() => post(`/api/admin/users/${id}/username`, { username: val, reason }), "Username changed").then(() => { setModal(null); q.reload(); })}><TextField label="New username" value={val} onChange={setVal} maxLength={12} /></ActionModal>}
      {modal === "email" && <ActionModal title="Change email" busy={busy} onClose={() => setModal(null)} onSubmit={(reason) => run(() => post(`/api/admin/users/${id}/email`, { email: val, reason }), "Email changed").then(() => { setModal(null); q.reload(); })}><TextField label="New email" type="email" value={val} onChange={setVal} /><p className="small muted">The old address gets a notice and the new one must be verified.</p></ActionModal>}
      {modal === "ban" && <ActionModal title="Ban account" danger busy={busy} onClose={() => setModal(null)} onSubmit={(reason) => run(() => post(`/api/admin/users/${id}/ban`, { reason, expiresAt: val === "perm" ? null : new Date(Date.now() + Number(val) * 86400_000).toISOString() }), "User banned").then(() => { setModal(null); q.reload(); })}>
        <div className="field"><label>Length</label><Select value={val} onChange={setVal} options={[...(can(a, "users.ban_temporary") ? [{ value: "1", label: "1 day" }, { value: "7", label: "7 days" }, { value: "30", label: "30 days" }] : []), ...(can(a, "users.ban_permanent") ? [{ value: "perm", label: "Permanent" }] : [])]} /></div></ActionModal>}
      {modal === "note" && <ActionModal title="Add internal note" noReason busy={busy} onClose={() => setModal(null)} onSubmit={() => run(() => post(`/api/admin/users/${id}/notes`, { body: val }), "Note added").then(() => { setModal(null); q.reload(); })}><TextField label="Note (visible to staff only)" value={val} onChange={setVal} textarea maxLength={4000} /></ActionModal>}
      {modal === "badge" && <ActionModal title="Assign badge" noReason busy={busy} onClose={() => setModal(null)} onSubmit={() => run(() => post(`/api/admin/users/${id}/badges`, { badgeId: val, reason: val2 }), "Badge assigned").then(() => { setModal(null); q.reload(); })}>
        <div className="field"><label>Badge</label><Select value={val} onChange={setVal} options={[{ value: "", label: "Choose a badge" }, ...(badges.data ?? []).filter((b: any) => b.enabled && !b.archivedAt && (b.availability === "assignable" || can(a, "badges.assign_restricted"))).map((b: any) => ({ value: b.id, label: `${b.name}${b.availability !== "assignable" ? " (restricted)" : ""}` }))]} /></div>
        <TextField label="Reason" value={val2} onChange={setVal2} maxLength={500} /></ActionModal>}
      {modal === "premium" && <ActionModal title="Grant Premium" busy={busy} onClose={() => setModal(null)} onSubmit={(reason) => run(() => post(`/api/admin/users/${id}/premium`, { reason, expiresAt: val ? new Date(val).toISOString() : null }), "Premium granted").then(() => { setModal(null); q.reload(); })}><div className="field"><label>Expires (leave empty for no expiry)</label><input className="input" type="date" value={val} onChange={(e) => setVal(e.target.value)} /></div></ActionModal>}
      {modal === "credits" && <ActionModal title="Adjust custom badge credits" busy={busy} onClose={() => setModal(null)} onSubmit={(reason) => run(() => post(`/api/admin/users/${id}/credits`, { delta: Number(val), reason }), "Credits adjusted").then(() => { setModal(null); q.reload(); })}><TextField label="Change (negative to remove)" type="number" value={val} onChange={setVal} /></ActionModal>}
    </div>;
  }}</Q>;
}

function ActionModal({ title, children, onClose, onSubmit, busy, danger, noReason }: { title: string; children: ReactNode; onClose: () => void; onSubmit: (reason: string) => void; busy: boolean; danger?: boolean; noReason?: boolean }) {
  const [reason, setReason] = useState("");
  return <Modal title={title} onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind={danger ? "danger" : "primary"} busy={busy} disabled={!noReason && reason.trim().length < 3} onClick={() => onSubmit(reason)}>{title}</Button></>}>
    {children}{!noReason && <TextField label="Reason (recorded in the audit log)" value={reason} onChange={setReason} maxLength={500} />}
  </Modal>;
}

// ------------------------------------------------------------------ moderation

export function Reports() {
  const [status, setStatus] = useState("pending");
  const q = useQuery<any>(`/api/admin/reports${qs({ status: status || undefined, limit: 100 })}`);
  const [open, setOpen] = useState<string | null>(null);
  return <div className="stack-24"><Head title="Reports"><Seg label="Status" value={status} onChange={setStatus} options={[{ value: "pending", label: "Pending" }, { value: "under_review", label: "Under review" }, { value: "resolved", label: "Resolved" }, { value: "rejected", label: "Rejected" }, { value: "", label: "All" }]} /></Head>
    <Q q={q}>{(d) => <Table head={["Reported", "Target", "Category", "Priority", "Reporter", "Assigned", "Status"]} empty={!d.items.length}>
      {d.items.map((r: any) => <tr key={r.id} className="click" onClick={() => setOpen(r.id)}><td>{ago(r.created_at)}</td><td><b>{r.target_username ?? r.target_ref ?? "—"}</b> {r.target_report_count > 1 && <span className="chip warn">{r.target_report_count} reports</span>}</td><td>{humanize(r.category)}</td><td>{statusChip(r.priority === "urgent" || r.priority === "high" ? "pending" : "draft")} {humanize(r.priority)}</td><td>{r.reporter_username ?? "—"}</td><td>{r.assigned_username ?? "—"}</td><td>{statusChip(r.status)}</td></tr>)}
    </Table>}</Q>
    {open && <ReportDetail id={open} onClose={() => { setOpen(null); q.reload(); }} />}
  </div>;
}

function ReportDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery<any>(`/api/admin/reports/${id}`);
  const a = useAdmin();
  const [note, setNote] = useState(""); const [res, setRes] = useState("");
  const { busy, run } = useAction();
  const upd = (body: object, msg: string) => run(() => patch(`/api/admin/reports/${id}`, body), msg).then(q.reload);
  return <Modal title="Report" onClose={onClose} wide><Q q={q}>{(r) => <>
    <dl className="kv small"><dt>Target</dt><dd>{r.target_user_id ? <Link to={`/admin/users/${r.target_user_id}`}>{r.target_username} (UID {r.target_uid})</Link> : r.target_ref}</dd><dt>Category</dt><dd>{humanize(r.category)}</dd><dt>Reporter</dt><dd>{r.reporter_username}</dd><dt>Status</dt><dd>{statusChip(r.status)} {r.resolution}</dd><dt>Created</dt><dd>{fmtDate(r.created_at, true)}</dd></dl>
    <div className="inset" style={{ padding: 12, whiteSpace: "pre-wrap" }}>{r.description}</div>
    {r.evidence.length > 0 && <div className="col small">{r.evidence.map((e: any) => <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer nofollow">{e.url}</a>)}</div>}
    <div className="row wrap">
      <Select label="Priority" value={r.priority} onChange={(v) => upd({ priority: v }, "Priority updated")} options={["low", "normal", "high", "urgent"]} />
      {r.status === "pending" && <Button size="sm" onClick={() => upd({ status: "under_review", assignToMe: true }, "Assigned to you")}>Take this report</Button>}
      {r.target_user_id && <Link className="btn sm" to={`/admin/users/${r.target_user_id}`}>Open user to take action</Link>}
    </div>
    <div className="row"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note" aria-label="Note" /><Button size="sm" disabled={!note} onClick={() => upd({ note }, "Note added").then(() => setNote(""))}>Add note</Button></div>
    {r.notes.map((n: any, i: number) => <div key={i} className="small"><b>{n.author}</b> <span className="dim">{fmtDate(n.at, true)}</span><div>{n.body}</div></div>)}
    {can(a, "moderation.manage") && r.status !== "resolved" && r.status !== "rejected" && <div className="stack-16"><TextField label="Resolution" value={res} onChange={setRes} maxLength={2000} /><div className="row"><Button kind="primary" busy={busy} disabled={!res} onClick={() => upd({ status: "resolved", resolution: res }, "Report resolved")}>Resolve</Button><Button busy={busy} disabled={!res} onClick={() => upd({ status: "rejected", resolution: res }, "Report rejected")}>Reject</Button></div></div>}
    <h3>Decision history</h3>{r.actions.map((x: any, i: number) => <div key={i} className="small">{fmtDate(x.at, true)} · {x.moderator}: {x.previous_status} → {x.new_status} — {x.reason}</div>)}
  </>}</Q></Modal>;
}

export function ModerationLog() {
  const q = useQuery<any[]>("/api/admin/moderation/actions?limit=300");
  return <div className="stack-24"><Head title="Content moderation" sub="Every moderation decision with moderator, target, reason and status change." /><Q q={q}>{(d) => <Table head={["When", "Moderator", "Target", "Action", "Reason", "Status"]} empty={!d.length}>
    {d.map((m) => <tr key={m.id}><td>{fmtDate(m.at, true)}</td><td>{m.moderator}</td><td>{m.target ?? "—"}</td><td>{humanize(m.action)}</td><td>{m.reason}</td><td className="small">{m.previous_status ?? "—"} → {m.new_status ?? "—"}</td></tr>)}</Table>}</Q></div>;
}

export function CustomBadgeReview() {
  const [status, setStatus] = useState("pending");
  const q = useQuery<any[]>(`/api/admin/custom-badges${qs({ status })}`);
  const { run } = useAction();
  const review = async (id: string, decision: string) => { const note = decision === "reject" ? prompt("Reason shown to the user") ?? "" : ""; await run(() => post(`/api/admin/custom-badges/${id}/review`, { decision, note }), decision === "approve" ? "Approved and assigned" : "Rejected and credit refunded"); q.reload(); };
  return <div className="stack-24"><Head title="Custom badge review"><Seg label="Status" value={status} onChange={setStatus} options={["pending", "approved", "rejected"]} /></Head><Q q={q}>{(d) => <Table head={["Badge", "Name", "User", "Requested", ""]} empty={!d.length}>
    {d.map((b) => <tr key={b.id}><td><img src={b.iconUrl} alt="" style={{ width: 32, height: 32, objectFit: "contain", background: "#0002", borderRadius: 6 }} /></td><td><b>{b.name}</b> <span style={{ color: b.color }}>●</span></td><td>{b.username} ({b.uid})</td><td>{fmtDate(b.created_at)}</td><td>{b.status === "pending" && <div className="row"><Button size="sm" kind="primary" onClick={() => review(b.id, "approve")}>Approve</Button><Button size="sm" onClick={() => review(b.id, "reject")}>Reject</Button></div>}</td></tr>)}</Table>}</Q></div>;
}

export function Tickets() {
  const [status, setStatus] = useState("awaiting_staff");
  const q = useQuery<any[]>(`/api/admin/tickets${qs({ status: status || undefined })}`);
  const [open, setOpen] = useState<string | null>(null);
  return <div className="stack-24"><Head title="Support tickets"><Seg label="Status" value={status} onChange={setStatus} options={[{ value: "awaiting_staff", label: "Waiting for staff" }, { value: "escalated", label: "Escalated" }, { value: "awaiting_user", label: "Waiting for user" }, { value: "closed", label: "Closed" }, { value: "", label: "All" }]} /></Head>
    <Q q={q}>{(d) => <Table head={["#", "Subject", "User", "Topic", "Priority", "Assigned", "Updated"]} empty={!d.length}>{d.map((t) => <tr key={t.id} className="click" onClick={() => setOpen(t.id)}><td>{t.number}</td><td><b>{t.subject}</b></td><td>{t.username}</td><td>{humanize(t.category)}</td><td>{humanize(t.priority)}</td><td>{t.assigned_username ?? "—"}</td><td>{ago(t.updated_at)}</td></tr>)}</Table>}</Q>
    {open && <TicketAdmin id={open} onClose={() => { setOpen(null); q.reload(); }} />}</div>;
}

function TicketAdmin({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery<any>(`/api/admin/tickets/${id}`);
  const a = useAdmin();
  const [msg, setMsg] = useState(""); const [internal, setInternal] = useState(false);
  const { busy, run } = useAction();
  const upd = (b: object) => run(() => patch(`/api/admin/tickets/${id}`, b), "Ticket updated").then(q.reload);
  return <Modal title="Ticket" onClose={onClose} wide><Q q={q}>{(t) => <>
    <div className="spread"><div><b>#{t.number} {t.subject}</b><div className="small dim">{t.username} (UID {t.uid}) · {humanize(t.category)} · {statusChip(t.status)}</div></div>
      {can(a, "support.manage") && <div className="row"><Select label="Priority" value={t.priority} onChange={(v) => upd({ priority: v })} options={["low", "normal", "high", "urgent"]} /><Button size="sm" onClick={() => upd({ assignToMe: true })}>Assign to me</Button><Button size="sm" onClick={() => upd({ status: "escalated" })}>Escalate</Button><Button size="sm" onClick={() => upd({ status: "closed" })}>Close</Button></div>}</div>
    <div className="col">{t.messages.map((m: any) => <div key={m.id} className="inset" style={{ padding: 12, borderColor: m.internal ? "rgba(245,183,89,.4)" : m.from_staff ? "rgba(79,140,255,.35)" : undefined }}>
      <div className="spread small"><b>{m.author}{m.internal ? " · internal note" : m.from_staff ? " · staff" : ""}</b><span className="dim">{fmtDate(m.at, true)}</span></div><p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{m.body}</p>
      {m.attachments.map((x: any) => <a key={x.id} href={x.url} target="_blank" rel="noreferrer" className="small">{x.name}</a>)}</div>)}</div>
    {can(a, "support.manage") && <div className="stack-16"><textarea className="textarea" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={internal ? "Internal note — only staff can see this" : "Reply to the user"} aria-label="Message" />
      <div className="spread"><label className="row small"><Toggle checked={internal} onChange={setInternal} label="Internal note" />Internal note</label><Button kind="primary" busy={busy} disabled={!msg.trim()} onClick={() => run(() => post(`/api/admin/tickets/${id}/messages`, { body: msg, internal })).then(() => { setMsg(""); q.reload(); })}>{internal ? "Add note" : "Send reply"}</Button></div></div>}
  </>}</Q></Modal>;
}

// ------------------------------------------------------------------ badges

const BLANK_BADGE = { key: "", name: "", description: "", tooltip: "", category: "special", rarity: "rare", iconAssetId: null as string | null, iconPreset: "star" as string | null, color: "#60a5fa", gradientFrom: null as string | null, gradientTo: null as string | null, borderColor: null as string | null, glow: 20, hover: "lift", displaySize: 22, sortOrder: 100, enabled: true, visibility: "public", availability: "assignable", eligibility: { method: "manual", minAccountAgeDays: null, registeredBefore: null, maxUid: null, note: "" } };
const PRESETS = ["crown", "check", "shield", "code", "star", "flame", "snowflake", "egg", "sun", "gem", "heart", "bolt", "trophy", "globe", "bug", "sparkles", "rocket", "music", "gamepad", "medal", "wrench", "bulb", "coins", "gift", "boost", "award", "image", "party"];

export function BadgeManager() {
  const [search, setSearch] = useState(""); const [arch, setArch] = useState(false);
  const s = useDebounced(search);
  const q = useQuery<any[]>(`/api/admin/badges${qs({ search: s, archived: arch ? 1 : undefined })}`);
  const a = useAdmin();
  const [edit, setEdit] = useState<any | null>(null);
  const [recip, setRecip] = useState<any | null>(null);
  const confirm = useConfirm();
  const { run } = useAction();
  return <div className="stack-24">
    <Head title="Badge manager" sub="Badges live in the database. Anything created here appears on profiles immediately — no code changes.">{can(a, "badges.create") && <Button kind="primary" onClick={() => setEdit({ ...BLANK_BADGE })}><LuPlus />Create badge</Button>}</Head>
    <div className="row"><input className="input" style={{ maxWidth: 260 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search badges" aria-label="Search badges" /><label className="row small"><Toggle checked={arch} onChange={setArch} label="Show archived" />Show archived</label></div>
    <Q q={q}>{(d) => <Table head={["", "Badge", "Category", "Availability", "Owners", "Enabled", ""]} empty={!d.length}>
      {d.map((b) => <tr key={b.id} style={{ opacity: b.archivedAt ? .5 : 1 }}>
        <td><BadgeIcon b={b} size={26} /></td><td><b>{b.name}</b><div className="small dim mono">{b.key}</div></td><td>{humanize(b.category)} · {humanize(b.rarity)}</td><td>{humanize(b.availability)}{b.visibility === "hidden" && <span className="chip dim">Hidden</span>}</td>
        <td><Button size="sm" kind="ghost" onClick={() => setRecip(b)}><LuUsers />{b.owners}</Button></td>
        <td><Toggle checked={b.enabled} disabled={!can(a, b.enabled ? "badges.disable" : "badges.enable")} label={`${b.name} enabled`} onChange={async (v) => { const ok = await confirm({ title: `${v ? "Enable" : "Disable"} ${b.name}?`, body: v ? undefined : "Nobody can newly receive it. Existing owners keep it.", reason: true }); if (ok) run(() => patch(`/api/admin/badges/${b.id}`, { enabled: v, reason: ok.reason }), v ? "Badge enabled" : "Badge disabled").then(q.reload); }} /></td>
        <td><div className="row">{can(a, "badges.edit") && <Button size="sm" kind="ghost" icon onClick={() => setEdit(b)} aria-label="Edit"><LuPencil /></Button>}
          {can(a, "badges.disable") && <Button size="sm" kind="ghost" icon aria-label={b.archivedAt ? "Unarchive" : "Archive"} onClick={() => run(() => post(`/api/admin/badges/${b.id}/archive`, { archived: !b.archivedAt }), b.archivedAt ? "Unarchived" : "Archived").then(q.reload)}><LuArchive /></Button>}
          {can(a, "badges.delete") && <Button size="sm" kind="ghost" icon aria-label="Delete" onClick={async () => { const ok = await confirm({ title: `Delete ${b.name}?`, body: "Only possible for badges that were never owned. Otherwise archive it.", danger: true, typeToConfirm: b.key }); if (ok) run(() => del(`/api/admin/badges/${b.id}`, { confirmKey: b.key }), "Badge deleted").then(q.reload); }}><LuTrash2 /></Button>}</div></td>
      </tr>)}</Table>}</Q>
    {edit && <BadgeEditor badge={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload(); }} />}
    {recip && <Recipients badge={recip} onClose={() => { setRecip(null); q.reload(); }} />}
  </div>;
}

function BadgeEditor({ badge, onClose, onSaved }: { badge: any; onClose: () => void; onSaved: () => void }) {
  const isNew = !badge.id;
  const [b, setB] = useState<any>({ ...BLANK_BADGE, ...badge, eligibility: { ...BLANK_BADGE.eligibility, ...(badge.eligibility ?? {}) } });
  const [art, setArt] = useState<string | null>(badge.iconUrl ?? null);
  const [prog, setProg] = useState<number | null>(null);
  const { busy, run } = useAction();
  const set = (k: string) => (v: any) => setB((x: any) => ({ ...x, [k]: v }));
  const preview = { ...b, iconUrl: b.iconAssetId ? art : null, tooltip: b.tooltip || b.name };
  const onFile = async (f: File) => {
    try {
      const up = await uploadFile(f, { kind: "icon", startPath: "/api/admin/badges/upload", completePath: (id) => `/api/admin/badges/upload/${id}/complete`, onProgress: setProg });
      setB((x: any) => ({ ...x, iconAssetId: up.id })); setArt(up.url); setProg(null);
    } catch (e) { toast((e as Error).message, "bad"); setProg(null); }
  };
  const save = () => {
    const { id, owners, iconUrl, archivedAt, createdAt, updatedAt, ...body } = b;
    void id; void owners; void iconUrl; void archivedAt; void createdAt; void updatedAt;
    return run(() => (isNew ? post("/api/admin/badges", body) : patch(`/api/admin/badges/${badge.id}`, (({ key, ...r }) => r)(body))), isNew ? "Badge created" : "Badge saved").then((r) => r && onSaved());
  };
  return <Modal title={isNew ? "Create badge" : `Edit ${badge.name}`} onClose={onClose} wide footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="primary" busy={busy} disabled={!b.name || !b.key} onClick={save}>{isNew ? "Create badge" : "Save changes"}</Button></>}>
    <div className="row" style={{ gap: 18, alignItems: "center" }}>
      <div className="inset" style={{ padding: 18, display: "grid", placeItems: "center", width: 120, height: 90 }}><BadgeIcon b={preview} size={b.displaySize * 1.6} /></div>
      <div className="small muted">Live preview. Hover it to see the tooltip and hover effect.</div>
    </div>
    <h3>Identity</h3>
    <div className="grid-2">
      <TextField label="Name" value={b.name} onChange={set("name")} maxLength={40} />
      <TextField label="Internal ID" value={b.key} onChange={(v) => set("key")(v.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} maxLength={40} disabled={!isNew} hint={isNew ? "Lowercase, permanent" : "Can't be changed"} />
      <TextField label="Tooltip" value={b.tooltip} onChange={set("tooltip")} maxLength={80} />
      <div className="field"><label>Category</label><Select value={b.category} onChange={set("category")} options={["verified", "premium", "staff", "developer", "founder", "early_supporter", "og", "community", "helper", "event", "milestone", "custom", "special"]} /></div>
    </div>
    <TextField label="Description" value={b.description} onChange={set("description")} textarea maxLength={300} />
    <div className="field"><label>Rarity</label><Seg label="Rarity" value={b.rarity} onChange={set("rarity")} options={["common", "uncommon", "rare", "epic", "legendary", "mythic"]} /></div>
    <h3>Artwork</h3>
    <div className="row wrap">
      <label className="btn sm">Upload artwork<input type="file" hidden accept="image/png,image/webp,image/gif,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} /></label>
      {b.iconAssetId && <Button size="sm" kind="ghost" onClick={() => setB((x: any) => ({ ...x, iconAssetId: null }))}>Use a built-in icon</Button>}
      {prog != null && <div className="progress" style={{ width: 140 }}><i style={{ width: `${prog * 100}%` }} /></div>}
    </div>
    {!b.iconAssetId && <div className="field"><label>Built-in icon</label><Select value={b.iconPreset ?? "star"} onChange={set("iconPreset")} options={PRESETS} /></div>}
    <h3>Appearance</h3>
    <div className="grid-2">
      <div className="field"><label>Colour</label><ColorField value={b.color} onChange={set("color")} label="Badge colour" /></div>
      <div className="field"><label>Gradient</label>{b.gradientFrom ? <div className="row"><ColorField value={b.gradientFrom} onChange={set("gradientFrom")} label="Gradient from" /><ColorField value={b.gradientTo ?? b.color} onChange={set("gradientTo")} label="Gradient to" /><Button size="sm" kind="ghost" onClick={() => setB((x: any) => ({ ...x, gradientFrom: null, gradientTo: null }))}>None</Button></div> : <Button size="sm" onClick={() => setB((x: any) => ({ ...x, gradientFrom: x.color, gradientTo: "#c4b5fd" }))}>Add gradient</Button>}</div>
      <div className="field"><label>Glow</label><Slider value={b.glow} min={0} max={100} onChange={set("glow")} label="Glow" /></div>
      <div className="field"><label>Display size</label><Slider value={b.displaySize} min={12} max={64} onChange={set("displaySize")} label="Size" /></div>
      <div className="field"><label>Hover effect</label><Select value={b.hover} onChange={set("hover")} options={["none", "lift", "glow", "scale", "spin", "shine"]} /></div>
      <div className="field"><label>Sort order</label><input className="input" type="number" value={b.sortOrder} onChange={(e) => set("sortOrder")(Number(e.target.value))} /></div>
      <div className="field"><label>Border colour</label>{b.borderColor ? <ColorField value={b.borderColor} onChange={set("borderColor")} label="Border" /> : <Button size="sm" onClick={() => set("borderColor")("#ffffff33")}>Add border</Button>}</div>
    </div>
    <h3>Availability</h3>
    <div className="grid-2">
      <div className="field"><label>Who can assign it</label><Select value={b.availability} onChange={set("availability")} options={[{ value: "assignable", label: "Any staff with badges.assign" }, { value: "restricted", label: "Restricted (badges.assign_restricted)" }, { value: "event_only", label: "Events only" }, { value: "purchase_only", label: "Purchases only" }, { value: "automatic", label: "Automatic (milestones)" }]} /></div>
      <div className="field"><label>Visibility</label><Select value={b.visibility} onChange={set("visibility")} options={[{ value: "public", label: "Shown on profiles" }, { value: "hidden", label: "Hidden from profiles" }]} /></div>
    </div>
    <ToggleRow label="Enabled" hint="Disabled badges can't be newly assigned; owners keep them." checked={b.enabled} onChange={set("enabled")} />
    <h3>Eligibility notes</h3>
    <div className="grid-2">
      <div className="field"><label>Minimum account age (days)</label><input className="input" type="number" value={b.eligibility.minAccountAgeDays ?? ""} onChange={(e) => setB((x: any) => ({ ...x, eligibility: { ...x.eligibility, minAccountAgeDays: e.target.value ? Number(e.target.value) : null } }))} /></div>
      <div className="field"><label>Registered before</label><input className="input" type="date" value={b.eligibility.registeredBefore?.slice(0, 10) ?? ""} onChange={(e) => setB((x: any) => ({ ...x, eligibility: { ...x.eligibility, registeredBefore: e.target.value ? new Date(e.target.value).toISOString() : null } }))} /></div>
    </div>
    <TextField label="Acquisition note (for staff)" value={b.eligibility.note} onChange={(v) => setB((x: any) => ({ ...x, eligibility: { ...x.eligibility, note: v } }))} maxLength={200} />
  </Modal>;
}

function Recipients({ badge, onClose }: { badge: any; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const s = useDebounced(search);
  const q = useQuery<any[]>(`/api/admin/badges/${badge.id}/recipients${qs({ search: s })}`);
  const hist = useQuery<any[]>(`/api/admin/badges/${badge.id}/history`);
  const a = useAdmin();
  const [assign, setAssign] = useState("");
  const { busy, run } = useAction();
  const doAssign = async () => {
    const u = await get(`/api/admin/users${qs({ q: assign.trim(), limit: 1 })}`);
    if (!u.items[0]) { toast("User not found", "bad"); return; }
    await run(() => post(`/api/admin/users/${u.items[0].id}/badges`, { badgeId: badge.id, reason: "Assigned from badge manager" }), `Assigned to ${u.items[0].username}`);
    setAssign(""); q.reload(); hist.reload();
  };
  return <Modal title={`${badge.name} — recipients`} onClose={onClose} wide>
    {can(a, "badges.assign") && badge.enabled && <div className="row"><input className="input" value={assign} onChange={(e) => setAssign(e.target.value)} placeholder="Username or UID" aria-label="Assign to" /><Button busy={busy} disabled={!assign} onClick={doAssign}>Assign</Button></div>}
    <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipients" aria-label="Search recipients" />
    <Q q={q}>{(d) => <div className="table-wrap"><table className="t"><thead><tr><th>UID</th><th>User</th><th>Method</th><th>Since</th></tr></thead><tbody>{d.map((u) => <tr key={u.id}><td>{u.uid}</td><td><Link to={`/admin/users/${u.id}`}>{u.username}</Link></td><td>{humanize(u.method)}</td><td>{fmtDate(u.acquired_at)}</td></tr>)}{!d.length && <tr><td colSpan={4} className="muted">No recipients</td></tr>}</tbody></table></div>}</Q>
    <h3>Assignment history</h3>
    <Q q={hist}>{(d) => <div className="table-wrap"><table className="t"><tbody>{d.slice(0, 50).map((h) => <tr key={h.id}><td>{fmtDate(h.at, true)}</td><td>{humanize(h.action)}</td><td>{h.recipient} ({h.recipient_uid})</td><td>{h.actor ?? "System"}</td><td>{humanize(h.method)}</td><td className="small muted">{h.reason}</td></tr>)}</tbody></table></div>}</Q>
  </Modal>;
}

export function BadgeAssignments() {
  const q = useQuery<any[]>("/api/admin/badge-history");
  return <div className="stack-24"><Head title="Badge assignments" sub="Every assignment and revocation, with who, how and why." /><Q q={q}>{(d) => <Table head={["When", "Badge", "Action", "Recipient", "Method", "By", "Reason"]} empty={!d.length}>
    {d.map((h) => <tr key={h.id}><td>{fmtDate(h.at, true)}</td><td>{h.badge_name}</td><td>{humanize(h.action)}</td><td>{h.recipient} ({h.recipient_uid})</td><td>{humanize(h.method)}</td><td>{h.actor ?? "System"}</td><td className="small muted">{h.reason}</td></tr>)}</Table>}</Q></div>;
}

// ------------------------------------------------------------------ events & milestones

export function Events() {
  const q = useQuery<any[]>("/api/admin/events");
  const badges = useQuery<any[]>("/api/admin/badges");
  const a = useAdmin();
  const [edit, setEdit] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  return <div className="stack-24">
    <Head title="Seasonal events" sub="One-time editions. Distribution runs as a background job when the event starts, resumes after downtime, and never duplicates a badge.">{can(a, "badges.manage_events") && <Button kind="primary" onClick={() => setEdit({})}><LuPlus />New event</Button>}</Head>
    <Q q={q}>{(d) => <Table head={["Event", "Badge", "Starts", "Ends", "Registration cutoff", "Status", "Recipients", ""]} empty={!d.length}>
      {d.map((e) => <tr key={e.id}><td><b>{e.name}</b><div className="small dim mono">{e.key}</div></td><td>{e.badge_name ?? "—"}</td><td>{fmtDate(e.starts_at, true)}</td><td>{fmtDate(e.ends_at, true)}</td><td>{fmtDate(e.registration_cutoff, true)}</td><td>{statusChip(e.enabled ? e.status : "disabled")}</td><td>{e.recipients}{e.failures > 0 && <span className="chip bad">{e.failures} failed</span>}</td>
        <td><div className="row"><Button size="sm" onClick={() => setDetail(e)}>Open</Button>{can(a, "badges.manage_events") && <Button size="sm" kind="ghost" icon onClick={() => setEdit(e)} aria-label="Edit event"><LuPencil /></Button>}</div></td></tr>)}</Table>}</Q>
    {edit && <EventEditor ev={edit} badges={badges.data ?? []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload(); }} />}
    {detail && <EventDetail ev={detail} onClose={() => { setDetail(null); q.reload(); }} />}
  </div>;
}

function EventEditor({ ev, badges, onClose, onSaved }: { ev: any; badges: any[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !ev.id;
  const a = useAdmin();
  const local = (d: string | null) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const [f, setF] = useState<any>({ key: ev.key ?? "", name: ev.name ?? "", description: ev.description ?? "", badgeId: ev.badge_id ?? "", startsAt: local(ev.starts_at), endsAt: local(ev.ends_at), registrationCutoff: local(ev.registration_cutoff), enabled: ev.enabled ?? true, eligibility: { minAccountAgeDays: 0, requireVerifiedEmail: false, requireLoginDuringEvent: false, premiumOnly: false, requirePurchaseDuringEvent: false, maxUid: null, registeredBefore: null, ...(ev.eligibility ?? {}) } });
  const [override, setOverride] = useState(false); const [reason, setReason] = useState("");
  const started = ev.starts_at && new Date(ev.starts_at) <= new Date();
  const { busy, run } = useAction();
  const set = (k: string) => (v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const setE = (k: string) => (v: any) => setF((x: any) => ({ ...x, eligibility: { ...x.eligibility, [k]: v } }));
  const iso = (s: string) => (s ? new Date(s).toISOString() : null);
  const save = () => {
    const body: any = { name: f.name, description: f.description, badgeId: f.badgeId || null, startsAt: iso(f.startsAt), endsAt: iso(f.endsAt), registrationCutoff: iso(f.registrationCutoff), eligibility: f.eligibility, enabled: f.enabled };
    if (isNew) return run(() => post("/api/admin/events", { key: f.key, ...body }), "Event created").then((r) => r && onSaved());
    if (started && override) Object.assign(body, { ownerOverride: true, reason });
    if (started && !override) { delete body.eligibility; delete body.registrationCutoff; delete body.startsAt; delete body.endsAt; delete body.badgeId; }
    return run(() => patch(`/api/admin/events/${ev.id}`, body), "Event saved").then((r) => r && onSaved());
  };
  const locked = started && !override;
  return <Modal title={isNew ? "New event" : `Edit ${ev.name}`} onClose={onClose} wide footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="primary" busy={busy} disabled={!f.name || (isNew && !f.key) || (override && reason.length < 3)} onClick={save}>Save</Button></>}>
    {started && <div className="banner warn small">This event has started. Eligibility, dates and badge are locked{a.role === "OWNER" ? " unless you override (recorded in the audit log)." : ". Only the owner can override."}
      {a.role === "OWNER" && <label className="row" style={{ marginLeft: "auto" }}><Toggle checked={override} onChange={setOverride} label="Owner override" />Override</label>}</div>}
    {override && <TextField label="Reason for override" value={reason} onChange={setReason} maxLength={500} />}
    <div className="grid-2">
      <TextField label="Name" value={f.name} onChange={set("name")} maxLength={60} />
      <TextField label="Internal ID" value={f.key} onChange={(v) => set("key")(v.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} disabled={!isNew} />
    </div>
    <TextField label="Description" value={f.description} onChange={set("description")} textarea maxLength={500} />
    <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }} className="stack-16">
      <div className="field"><label>Badge</label><Select value={f.badgeId} onChange={set("badgeId")} options={[{ value: "", label: "No badge" }, ...badges.filter((b) => !b.archivedAt).map((b) => ({ value: b.id, label: b.name }))]} /></div>
      <div className="grid-3">
        <div className="field"><label>Starts</label><input className="input" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt")(e.target.value)} /></div>
        <div className="field"><label>Ends</label><input className="input" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt")(e.target.value)} /></div>
        <div className="field"><label>Registered before</label><input className="input" type="datetime-local" value={f.registrationCutoff} onChange={(e) => set("registrationCutoff")(e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label>Minimum account age (days)</label><input className="input" type="number" min={0} value={f.eligibility.minAccountAgeDays} onChange={(e) => setE("minAccountAgeDays")(Number(e.target.value))} /></div>
        <div className="field"><label>Only UIDs up to</label><input className="input" type="number" value={f.eligibility.maxUid ?? ""} onChange={(e) => setE("maxUid")(e.target.value ? Number(e.target.value) : null)} /></div>
      </div>
      <ToggleRow label="Require verified email" checked={f.eligibility.requireVerifiedEmail} onChange={setE("requireVerifiedEmail")} />
      <ToggleRow label="Require a sign-in during the event" checked={f.eligibility.requireLoginDuringEvent} onChange={setE("requireLoginDuringEvent")} />
      <ToggleRow label="Premium members only" checked={f.eligibility.premiumOnly} onChange={setE("premiumOnly")} />
      <ToggleRow label="Require a purchase during the event (sale badge)" checked={f.eligibility.requirePurchaseDuringEvent} onChange={setE("requirePurchaseDuringEvent")} />
    </fieldset>
    <ToggleRow label="Enabled" hint="Disabled events never distribute." checked={f.enabled} onChange={set("enabled")} />
  </Modal>;
}

function EventDetail({ ev, onClose }: { ev: any; onClose: () => void }) {
  const preview = useQuery<any>(`/api/admin/events/${ev.id}/preview`);
  const hist = useQuery<any[]>(`/api/admin/events/${ev.id}/history`);
  const rec = useQuery<any[]>(`/api/admin/events/${ev.id}/recipients`);
  const a = useAdmin();
  const confirm = useConfirm();
  const { busy, run } = useAction();
  const failed = (rec.data ?? []).filter((r) => r.status === "failed").length;
  return <Modal title={ev.name} onClose={onClose} wide>
    <div className="row wrap">
      <Stat k="Eligible now" v={preview.data?.eligible ?? "…"} /><Stat k="Recipients" v={(rec.data ?? []).filter((r) => r.status !== "failed").length} /><Stat k="Failures" v={failed} />
    </div>
    {can(a, "badges.manage_events") && <div className="row">
      <Button kind="primary" busy={busy} onClick={async () => { if (await confirm({ title: "Start distribution now?", body: `Assigns ${ev.badge_name ?? "the badge"} to everyone eligible. Safe to run again — nobody gets it twice.`, confirm: "Start" })) run(() => post(`/api/admin/events/${ev.id}/distribute`), "Distribution started").then(() => setTimeout(() => { hist.reload(); rec.reload(); }, 1500)); }}><LuPlay />Distribute now</Button>
      <Button busy={busy} disabled={!failed} onClick={() => run(() => post(`/api/admin/events/${ev.id}/retry`), "Retrying failures").then(() => setTimeout(() => { hist.reload(); rec.reload(); }, 1500))}><LuRefreshCw />Retry failures</Button>
      <a className="btn" href={`/api/admin/events/${ev.id}/recipients.csv`}><LuDownload />Export recipients</a>
    </div>}
    <h3>Preview of eligible users</h3>
    <div className="small">{preview.data?.sample.map((u: any) => u.username).join(", ") || "No eligible users"}{preview.data?.eligible > 50 && " …"}</div>
    <h3>Distribution history</h3>
    <div className="table-wrap"><table className="t"><thead><tr><th>Started</th><th>Trigger</th><th>By</th><th>Status</th><th>Assigned</th><th>Skipped</th><th>Failed</th></tr></thead><tbody>
      {(hist.data ?? []).map((h) => <tr key={h.id}><td>{fmtDate(h.started_at, true)}</td><td>{h.trigger}</td><td>{h.started_by_username ?? "System"}</td><td>{statusChip(h.status)}</td><td>{h.assigned}</td><td>{h.skipped}</td><td>{h.failed}</td></tr>)}
      {!hist.data?.length && <tr><td colSpan={7} className="muted">Not distributed yet</td></tr>}</tbody></table></div>
    {failed > 0 && <><h3>Failures</h3>{(rec.data ?? []).filter((r) => r.status === "failed").slice(0, 20).map((r) => <div key={r.uid} className="small">{r.username}: {r.error}</div>)}</>}
  </Modal>;
}

export function Milestones() {
  const q = useQuery<any>("/api/admin/milestones");
  const a = useAdmin();
  const { run } = useAction();
  return <div className="stack-24"><Head title="Milestones" sub="Based on permanent registration order (UIDs), never on how many accounts currently exist.">{can(a, "badges.manage_events") && <Button onClick={() => run(() => post("/api/admin/milestones/reconcile"), "Reconcile job queued").then(() => setTimeout(q.reload, 1500))}><LuRefreshCw />Repair missing OG badges</Button>}</Head>
    <Q q={q}>{(d) => <>
      <div className="grid-2"><Stat k="Registrations (permanent)" v={d.totalRegistrations.toLocaleString("en")} /><Stat k="Live accounts" v={d.liveAccounts.toLocaleString("en")} /></div>
      {d.milestones.map((m: any) => <div key={m.key} className="panel pad stack-16">
        <div className="spread"><h3>{m.name}</h3>{statusChip(m.status === "triggered" || m.status === "closed" ? "completed" : "pending")}</div>
        <div className="progress"><i style={{ width: `${m.progress * 100}%` }} /></div>
        <dl className="kv small"><dt>Rule</dt><dd>{m.kind === "first_n" ? `UIDs 1–${m.threshold} receive it at registration` : `Triggers once at UID ${m.threshold}`}</dd><dt>Badge</dt><dd className="mono">{m.badge_key}</dd>
          <dt>Triggered</dt><dd>{fmtDate(m.triggered_at, true)}</dd><dt>Recipients</dt><dd>{m.recipients} ({m.assignments} assignments recorded)</dd><dt>Failed assignments</dt><dd>{m.failures}</dd></dl>
      </div>)}</>}</Q></div>;
}

// ------------------------------------------------------------------ monetization

export function PremiumUsers() {
  const q = useQuery<any[]>("/api/admin/premium-users");
  const v = useQuery<any[]>("/api/admin/verified-users");
  const c = useQuery<any[]>("/api/admin/credits");
  return <div className="stack-24"><Head title="Premium subscribers" />
    <Q q={q}>{(d) => <Table head={["User", "Source", "Since", "Expires", "Granted by", "Reason"]} empty={!d.length}>{d.map((e) => <tr key={e.id}><td>{e.username} ({e.uid})</td><td>{e.source === "admin_grant" ? "Granted" : humanize(e.source)}</td><td>{fmtDate(e.starts_at)}</td><td>{fmtDate(e.expires_at) === "—" ? "No expiry" : fmtDate(e.expires_at)}</td><td>{e.granted_by ?? "—"}</td><td className="small muted">{e.reason}</td></tr>)}</Table>}</Q>
    <h2>Verified</h2><p className="muted small">Purchased and staff-granted verification are recorded separately.</p>
    <Q q={v}>{(d) => <Table head={["User", "How", "When", "Granted by", "Reason"]} empty={!d.length}>{d.map((e, i) => <tr key={i}><td>{e.username} ({e.uid})</td><td>{e.source === "purchase" ? <span className="chip">Purchased</span> : <span className="chip ok">Granted by staff</span>}</td><td>{fmtDate(e.created_at)}</td><td>{e.granted_by ?? "—"}</td><td className="small muted">{e.reason}</td></tr>)}</Table>}</Q>
    <h2>Custom badge credits</h2>
    <Q q={c}>{(d) => <Table head={["User", "Balance"]} empty={!d.length}>{d.map((e, i) => <tr key={i}><td>{e.username} ({e.uid})</td><td>{e.balance}</td></tr>)}</Table>}</Q>
  </div>;
}
export function Subscriptions() {
  const q = useQuery<any[]>("/api/admin/subscriptions");
  return <div className="stack-24"><Head title="Subscriptions" /><Q q={q}>{(d) => <Table head={["User", "Product", "Status", "Period end", "Cancelling", "Provider ID"]} empty={!d.length}>{d.map((s) => <tr key={s.id}><td>{s.username}</td><td>{s.product_key}</td><td>{statusChip(s.status)}</td><td>{fmtDate(s.current_period_end)}</td><td>{s.cancel_at_period_end ? "Yes" : "No"}</td><td className="mono small">{s.provider_sub_id}</td></tr>)}</Table>}</Q></div>;
}
export function Purchases() {
  const [status, setStatus] = useState("");
  const q = useQuery<any[]>(`/api/admin/purchases${qs({ status: status || undefined })}`);
  const a = useAdmin();
  const confirm = useConfirm();
  const { run } = useAction();
  return <div className="stack-24"><Head title="Purchases"><Seg label="Status" value={status} onChange={setStatus} options={[{ value: "", label: "All" }, "paid", "pending", "refunded", "failed"]} /></Head>
    <Q q={q}>{(d) => <Table head={["When", "User", "Product", "Amount", "Refunded", "Status", ""]} empty={!d.length}>{d.map((p) => <tr key={p.id}><td>{fmtDate(p.created_at, true)}</td><td>{p.username}</td><td>{humanize(p.product_key)}</td><td>{fmtMoney(p.amount_cents, p.currency)}</td><td>{p.refunded_cents ? fmtMoney(p.refunded_cents, p.currency) : "—"}</td><td>{statusChip(p.status)}</td>
      <td>{can(a, "payments.refund") && (p.status === "paid" || p.status === "partially_refunded") && <Button size="sm" onClick={async () => { const ok = await confirm({ title: `Refund ${fmtMoney(p.amount_cents, p.currency)} to ${p.username}?`, body: "The refund is sent to the payment provider; entitlements are revoked once it confirms.", reason: true, danger: true, confirm: "Refund" }); if (ok) run(() => post(`/api/admin/purchases/${p.id}/refund`, { reason: ok.reason }), "Refund requested").then(q.reload); }}>Refund</Button>}</td></tr>)}</Table>}</Q></div>;
}
export function Transactions() {
  const q = useQuery<any[]>("/api/admin/transactions");
  return <div className="stack-24"><Head title="Transactions" /><Q q={q}>{(d) => <Table head={["When", "User", "Product", "Amount", "Status", "Provider ID"]} empty={!d.length}>{d.map((t) => <tr key={t.id}><td>{fmtDate(t.at, true)}</td><td>{t.username ?? "—"}</td><td>{t.product_key ?? "—"}</td><td>{fmtMoney(t.amount_cents, t.currency)}</td><td>{statusChip(t.status)}</td><td className="mono small">{t.provider_payment_id}</td></tr>)}</Table>}</Q></div>;
}
export function Refunds() {
  const q = useQuery<any[]>("/api/admin/refunds");
  return <div className="stack-24"><Head title="Refunds" /><Q q={q}>{(d) => <Table head={["When", "User", "Product", "Amount", "Status", "Requested by", "Reason"]} empty={!d.length}>{d.map((r) => <tr key={r.id}><td>{fmtDate(r.at, true)}</td><td>{r.username}</td><td>{r.product_key}</td><td>{fmtMoney(r.amount_cents)}</td><td>{statusChip(r.status)}</td><td>{r.requested_by_username ?? "Provider"}</td><td className="small muted">{r.reason}</td></tr>)}</Table>}</Q></div>;
}
export function Products() {
  const q = useQuery<any>("/api/admin/products");
  const a = useAdmin();
  const confirm = useConfirm();
  const { run } = useAction();
  const owner = can(a, "premium.manage");
  return <div className="stack-24"><Head title="Products and pricing" sub="Prices apply to new checkouts." /><Q q={q}>{(d) => <>
    <div className="panel pad"><ToggleRow label="Premium purchases" hint={owner ? "When off, nobody can buy Premium. Existing Premium members keep it, and you can still grant it manually." : "Only the owner can change this."} checked={d.premiumEnabled} disabled={!owner}
      onChange={async (v) => { const ok = await confirm({ title: v ? "Turn on Premium purchases?" : "Turn off Premium purchases?", reason: true }); if (ok) run(() => put("/api/admin/premium/enabled", { enabled: v, reason: ok.reason }), v ? "Premium is on sale" : "Premium purchases turned off").then(q.reload); }} />
      <p className="small dim" style={{ marginTop: 8 }}>Payment provider: {d.provider}</p></div>
    {d.products.map((p: any) => <ProductRow key={p.key} p={p} editable={owner} onSaved={q.reload} />)}
  </>}</Q></div>;
}
function ProductRow({ p, editable, onSaved }: { p: any; editable: boolean; onSaved: () => void }) {
  const [price, setPrice] = useState((p.price_cents / 100).toFixed(2)); const [name, setName] = useState(p.name); const [desc, setDesc] = useState(p.description);
  const { busy, run } = useAction();
  return <div className="panel pad stack-16"><div className="spread"><h3>{p.name} <span className="small dim">· {p.billing === "monthly" ? "monthly" : "one-time"}</span></h3><Toggle checked={p.enabled} disabled={!editable} label={`${p.name} enabled`} onChange={(v) => run(() => patch(`/api/admin/products/${p.key}`, { enabled: v }), v ? "Product enabled" : "Product disabled").then(onSaved)} /></div>
    <div className="grid-3"><TextField label="Name" value={name} onChange={setName} disabled={!editable} /><TextField label={`Price (${p.currency.toUpperCase()})`} value={price} onChange={setPrice} disabled={!editable} inputMode="decimal" /><TextField label="Description" value={desc} onChange={setDesc} disabled={!editable} /></div>
    <div className="spread"><span className="small dim">Grants: {JSON.stringify(p.grants)} · updated {fmtDate(p.updated_at, true)}</span>{editable && <Button size="sm" kind="primary" busy={busy} onClick={() => run(() => patch(`/api/admin/products/${p.key}`, { name, description: desc, priceCents: Math.round(Number(price) * 100) }), "Product saved").then(onSaved)}>Save</Button>}</div></div>;
}

// ------------------------------------------------------------------ staff & permissions

export function StaffList({ role }: { role: "STAFF" | "ADMIN" }) {
  const q = useQuery<any>("/api/admin/staff");
  const perms = useQuery<any>("/api/admin/permissions");
  const a = useAdmin();
  const confirm = useConfirm();
  const { busy, run } = useAction();
  const [adding, setAdding] = useState(false); const [did, setDid] = useState(""); const [note, setNote] = useState("");
  const [editPerms, setEditPerms] = useState<any | null>(null);
  const canManage = role === "ADMIN" ? can(a, "admins.manage") : can(a, "staff.manage");
  return <div className="stack-24">
    <Head title={role === "ADMIN" ? "Administrators" : "Staff members"} sub="Authorization is tied to Discord IDs. People can be added before they sign up; it links automatically when they do.">{canManage && <Button kind="primary" onClick={() => setAdding(true)}><LuPlus />Add {role === "ADMIN" ? "administrator" : "staff"}</Button>}</Head>
    <Q q={q}>{(d) => <>
      {role === "ADMIN" && d.owner && <div className="panel pad row"><LuShieldCheck color="var(--warn)" /><div className="grow"><b>Owner</b> · {d.owner.linkedUsername ?? "not signed up yet"} <span className="mono small dim">{d.owner.discordId}</span><div className="small dim">Set by LORN_OWNER_DISCORD_ID on the server. Can't be changed from the panel.</div></div><span className="chip">OWNER</span></div>}
      <Table head={["Discord ID", "Linked account", "Status", "Added", "Last active", "Permissions", ""]} empty={!d.staff.filter((s: any) => s.role === role).length}>
        {d.staff.filter((s: any) => s.role === role).map((s: any) => <tr key={s.id}>
          <td className="mono">{s.discord_id}</td><td>{s.linked_username ? `${s.linked_username} (${s.linked_uid})` : <span className="dim">Not signed up</span>}{s.note && <div className="small dim">{s.note}</div>}</td>
          <td>{s.active ? <span className="chip ok">Active</span> : <span className="chip warn">Suspended</span>}</td><td className="small">{fmtDate(s.added_at)} by {s.added_by_username ?? "—"}</td><td className="small">{s.last_activity_at ? ago(s.last_activity_at) : "—"}</td>
          <td className="small">{s.effectivePermissions.length} · {s.overrides.length} custom</td>
          <td><div className="row">
            {can(a, "permissions.manage") && <Button size="sm" onClick={() => setEditPerms(s)}>Permissions</Button>}
            {canManage && <>
              <Button size="sm" kind="ghost" onClick={async () => { const ok = await confirm({ title: s.active ? "Suspend access?" : "Reactivate access?", body: s.active ? "Their admin access ends immediately." : undefined, reason: true, danger: s.active }); if (ok) run(() => patch(`/api/admin/staff/${s.id}`, { active: !s.active, reason: ok.reason }), s.active ? "Suspended" : "Reactivated").then(q.reload); }}>{s.active ? "Suspend" : "Reactivate"}</Button>
              {can(a, "admins.manage") && <Button size="sm" kind="ghost" onClick={async () => { const ok = await confirm({ title: `Make ${role === "ADMIN" ? "staff" : "administrator"}?`, reason: true }); if (ok) run(() => patch(`/api/admin/staff/${s.id}`, { role: role === "ADMIN" ? "STAFF" : "ADMIN", reason: ok.reason }), "Role changed").then(q.reload); }}>{role === "ADMIN" ? "Demote" : "Promote"}</Button>}
              <Button size="sm" kind="ghost" icon aria-label="Remove" onClick={async () => { const ok = await confirm({ title: "Remove authorization?", body: "Access ends immediately.", reason: true, danger: true, confirm: "Remove" }); if (ok) run(() => del(`/api/admin/staff/${s.id}`, { reason: ok.reason }), "Removed").then(q.reload); }}><LuTrash2 /></Button>
            </>}
          </div></td>
        </tr>)}
      </Table>
    </>}</Q>
    {adding && <Modal title={`Add ${role === "ADMIN" ? "administrator" : "staff"}`} onClose={() => setAdding(false)} footer={<><Button kind="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button kind="primary" busy={busy} disabled={!/^\d{17,20}$/.test(did)} onClick={() => run(() => post("/api/admin/staff", { discordId: did, role, note: note || undefined }), "Authorized").then((r) => { if (r) { setAdding(false); setDid(""); setNote(""); q.reload(); } })}>Authorize</Button></>}>
      <TextField label="Discord user ID" value={did} onChange={(v) => setDid(v.replace(/\D/g, ""))} hint="Enable Developer Mode in Discord, right-click the user, Copy User ID" inputMode="numeric" />
      <TextField label="Note" value={note} onChange={setNote} maxLength={200} />
    </Modal>}
    {editPerms && perms.data && <StaffPerms staff={editPerms} registry={perms.data.registry} onClose={() => { setEditPerms(null); q.reload(); }} />}
  </div>;
}

function StaffPerms({ staff, registry, onClose }: { staff: any; registry: any[]; onClose: () => void }) {
  const [eff, setEff] = useState<string[]>(staff.effectivePermissions);
  const [ov, setOv] = useState<Record<string, boolean>>(Object.fromEntries(staff.overrides.map((o: any) => [o.permission, o.granted])));
  const { run } = useAction();
  const setState = (perm: string, state: "grant" | "revoke" | "default") => run(() => put(`/api/admin/staff/${staff.id}/permissions/${perm}`, { state })).then((r: any) => {
    if (!r) return;
    setEff(r.effectivePermissions);
    setOv((o) => { const n = { ...o }; if (state === "default") delete n[perm]; else n[perm] = state === "grant"; return n; });
  });
  const cats = [...new Set(registry.map((p) => p.category))];
  return <Modal title={`Permissions — ${staff.linked_username ?? staff.discord_id}`} onClose={onClose} wide>
    <p className="small muted">Starts from the {staff.role} role defaults. Grant or revoke individually; changes apply on their next request. Owner-only permissions can't be granted.</p>
    {cats.map((cat) => <div key={cat}><h4 style={{ margin: "12px 0 6px" }}>{humanize(cat)}</h4>
      {registry.filter((p) => p.category === cat).map((p) => {
        const state = p.key in ov ? (ov[p.key] ? "grant" : "revoke") : "default";
        return <div key={p.key} className="spread small" style={{ padding: "5px 0", borderBottom: "1px solid var(--hair)" }}>
          <div><span className="mono">{p.key}</span> {eff.includes(p.key) ? <span className="chip ok">On</span> : <span className="chip dim">Off</span>} {p.ownerOnly && <span className="chip warn">Owner only</span>}<div className="dim">{p.description}</div></div>
          {!p.ownerOnly && <Seg label={p.key} value={state} onChange={(v) => setState(p.key, v as any)} options={[{ value: "default", label: "Role default" }, { value: "grant", label: "Grant" }, { value: "revoke", label: "Revoke" }]} />}
        </div>;
      })}</div>)}
  </Modal>;
}

export function PermissionManager() {
  const q = useQuery<any>("/api/admin/permissions");
  const a = useAdmin();
  const { run } = useAction();
  const edit = can(a, "permissions.manage");
  return <div className="stack-24"><Head title="Permission manager" sub="Role defaults for every staff member. Individual grants and revokes are on each person's page. The owner always has everything." />
    <Q q={q}>{(d) => <div className="panel"><div className="table-wrap"><table className="t"><thead><tr><th>Permission</th><th>Description</th><th>Admin</th><th>Staff</th></tr></thead><tbody>
      {d.registry.map((p: any) => <tr key={p.key}><td className="mono small">{p.key} {p.ownerOnly && <span className="chip warn">Owner only</span>}</td><td className="small muted">{p.description}</td>
        {(["ADMIN", "STAFF"] as const).map((role) => <td key={role}><Toggle checked={d.roleDefaults[role].includes(p.key)} disabled={!edit || p.ownerOnly} label={`${role} ${p.key}`} onChange={(v) => run(() => put(`/api/admin/permissions/roles/${role}/${p.key}`, { enabled: v })).then(q.reload)} /></td>)}</tr>)}
    </tbody></table></div></div>}</Q></div>;
}

// ------------------------------------------------------------------ platform

export function Announcements() {
  const q = useQuery<any[]>("/api/admin/announcements");
  const [edit, setEdit] = useState<any | null>(null);
  const confirm = useConfirm();
  const { busy, run } = useAction();
  const save = () => { const { id, title, body, level, published } = edit; return run(() => (id ? patch(`/api/admin/announcements/${id}`, { title, body, level, published }) : post("/api/admin/announcements", { title, body, level, published })), "Saved").then((r) => { if (r) { setEdit(null); q.reload(); } }); };
  return <div className="stack-24"><Head title="Announcements" sub="Published announcements show on every user's dashboard."><Button kind="primary" onClick={() => setEdit({ title: "", body: "", level: "info", published: false })}><LuPlus />New announcement</Button></Head>
    <Q q={q}>{(d) => <Table head={["Title", "Level", "Published", "By", "Created", ""]} empty={!d.length}>{d.map((x) => <tr key={x.id}><td><b>{x.title}</b><div className="small muted">{x.body.slice(0, 100)}</div></td><td>{humanize(x.level)}</td><td><Toggle checked={x.published} label="Published" onChange={(v) => run(() => patch(`/api/admin/announcements/${x.id}`, { published: v })).then(q.reload)} /></td><td>{x.author}</td><td>{fmtDate(x.created_at)}</td>
      <td><div className="row"><Button size="sm" kind="ghost" icon onClick={() => setEdit(x)} aria-label="Edit"><LuPencil /></Button><Button size="sm" kind="ghost" icon aria-label="Delete" onClick={async () => { if (await confirm({ title: "Delete announcement?", danger: true })) run(() => del(`/api/admin/announcements/${x.id}`), "Deleted").then(q.reload); }}><LuTrash2 /></Button></div></td></tr>)}</Table>}</Q>
    {edit && <Modal title={edit.id ? "Edit announcement" : "New announcement"} onClose={() => setEdit(null)} footer={<><Button kind="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button kind="primary" busy={busy} disabled={!edit.title || !edit.body} onClick={save}>Save</Button></>}>
      <TextField label="Title" value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} maxLength={100} />
      <TextField label="Message" value={edit.body} onChange={(v) => setEdit({ ...edit, body: v })} textarea maxLength={2000} />
      <div className="field"><label>Level</label><Seg label="Level" value={edit.level} onChange={(v) => setEdit({ ...edit, level: v })} options={["info", "success", "warning", "critical"]} /></div>
      <ToggleRow label="Published" checked={edit.published} onChange={(v) => setEdit({ ...edit, published: v })} />
    </Modal>}</div>;
}

export function Flags() {
  const q = useQuery<any[]>("/api/admin/flags");
  const a = useAdmin();
  const { run } = useAction();
  const edit = can(a, "flags.manage");
  return <div className="stack-24"><Head title="Feature flags" sub="Evaluated on the server wherever they protect functionality. Rollout uses a stable per-user bucket." />
    <Q q={q}>{(d) => <Table head={["Flag", "Enabled", "Rollout", "Staff only", "Updated"]}>{d.map((f) => <tr key={f.key}><td><b className="mono">{f.key}</b><div className="small muted">{f.description}</div></td>
      <td><Toggle checked={f.enabled} disabled={!edit} label={f.key} onChange={(v) => run(() => patch(`/api/admin/flags/${f.key}`, { enabled: v }), "Flag updated").then(q.reload)} /></td>
      <td style={{ width: 220 }}><Slider value={f.rollout_percent} min={0} max={100} label={`${f.key} rollout`} unit="%" onChange={(v) => edit && run(() => patch(`/api/admin/flags/${f.key}`, { rolloutPercent: v })).then(q.reload)} /></td>
      <td><Toggle checked={f.staff_only} disabled={!edit} label={`${f.key} staff only`} onChange={(v) => run(() => patch(`/api/admin/flags/${f.key}`, { staffOnly: v }), "Flag updated").then(q.reload)} /></td><td className="small">{ago(f.updated_at)}</td></tr>)}</Table>}</Q></div>;
}

export function Storage() {
  const q = useQuery<any>("/api/admin/storage");
  const a = useAdmin();
  const { run } = useAction();
  return <div className="stack-24"><Head title="Storage">{can(a, "storage.manage") && <Button onClick={() => run(() => post("/api/admin/storage/cleanup"), "Cleanup finished").then(q.reload)}><LuTrash2 />Clean up orphaned files</Button>}</Head>
    <Q q={q}>{(d) => <>
      <div className="panel pad small">Driver: {d.driver}</div>
      <div className="grid-3"><Stat k="Waiting for deletion" v={`${d.pendingDeletion.n} files · ${fmtBytes(Number(d.pendingDeletion.bytes))}`} /><Stat k="Abandoned uploads" v={d.abandonedUploads} /><Stat k="Quotas" v={`${d.limits.free} MB free · ${d.limits.premium} MB Premium`} /></div>
      <Table head={["Type", "Purpose", "Files", "Size"]}>{d.totals.map((t: any, i: number) => <tr key={i}><td>{t.kind}</td><td>{t.purpose}</td><td>{t.files}</td><td>{fmtBytes(Number(t.bytes))}</td></tr>)}</Table>
      <h3>Largest users</h3>
      <Table head={["User", "Files", "Size"]} empty={!d.topUsers.length}>{d.topUsers.map((u: any) => <tr key={u.uid}><td>{u.username} ({u.uid})</td><td>{u.files}</td><td>{fmtBytes(Number(u.bytes))}</td></tr>)}</Table>
      <p className="small muted">Upload limits and quotas are edited in Platform settings.</p>
    </>}</Q></div>;
}

export function IntegrationsAdmin() {
  const q = useQuery<any>("/api/admin/system");
  return <div className="stack-24"><Head title="Integrations" sub="Credentials live in server environment variables, never in the database or the browser." /><Q q={q}>{(d) => <>
    <Table head={["Integration", "Status", "Detail"]}>{Object.entries(d.integrations.config).map(([k, v]: any) => <tr key={k}><td><b>{humanize(k)}</b></td><td>{String(v).startsWith("not_configured") ? <span className="chip warn">Not configured</span> : <span className="chip ok">Available</span>}</td><td className="small muted">{v}</td></tr>)}
      {Object.entries(d.config).map(([k, v]: any) => <tr key={k}><td><b>{humanize(k)}</b></td><td>{String(v).startsWith("not_configured") ? <span className="chip warn">Not configured</span> : <span className="chip ok">Configured</span>}</td><td className="small muted">{v}</td></tr>)}</Table>
    <h3>Last 24 hours</h3><Table head={["Provider", "OK", "Errors", "Last call"]} empty={!d.integrations.last24h.length}>{d.integrations.last24h.map((r: any) => <tr key={r.provider}><td>{r.provider}</td><td>{r.ok}</td><td>{r.errors}</td><td>{ago(r.last)}</td></tr>)}</Table>
  </>}</Q></div>;
}

export function Settings() {
  const q = useQuery<any[]>("/api/admin/settings");
  const a = useAdmin();
  const confirm = useConfirm();
  const { run } = useAction();
  const groups = useMemo(() => { const g: Record<string, any[]> = {}; for (const s of q.data ?? []) (g[s.key.split(".")[0]] ??= []).push(s); return g; }, [q.data]);
  const save = async (s: any, value: any) => { const ok = await confirm({ title: `Change ${s.key}?`, reason: true, danger: s.key === "maintenance.enabled" && value === true }); if (ok) run(() => put(`/api/admin/settings/${s.key}`, { value, reason: ok.reason }), "Setting saved").then(q.reload); };
  return <div className="stack-24"><Head title="Platform settings" sub="Changes are audited. Protected settings can only be changed by the owner." />
    <Q q={q}>{() => <>{Object.entries(groups).map(([g, list]) => <div key={g} className="panel"><div className="panel-head"><h3>{humanize(g)}</h3></div><div className="panel-body col" style={{ gap: 14 }}>
      {list.map((s) => <SettingRow key={s.key} s={s} disabled={!can(a, "settings.edit") || (s.protected && !can(a, "settings.edit_protected"))} onSave={(v) => save(s, v)} />)}</div></div>)}</>}</Q></div>;
}
function SettingRow({ s, disabled, onSave }: { s: any; disabled: boolean; onSave: (v: any) => void }) {
  const [v, setV] = useState(s.value);
  useEffect(() => setV(s.value), [s.value]);
  const label = humanize(s.key.split(".").slice(1).join(" "));
  return <div className="spread"><div><b style={{ fontSize: 13.5 }}>{label}</b> {s.protected && <span className="chip warn">Owner only</span>}<div className="small dim mono">{s.key}</div></div>
    {typeof s.value === "boolean" ? <Toggle checked={s.value} disabled={disabled} label={label} onChange={onSave} /> :
      <div className="row"><input className="input" style={{ width: typeof s.value === "number" ? 110 : 320 }} type={typeof s.value === "number" ? "number" : "text"} value={v} disabled={disabled} onChange={(e) => setV(typeof s.value === "number" ? Number(e.target.value) : e.target.value)} aria-label={label} />
        <Button size="sm" disabled={disabled || v === s.value} onClick={() => onSave(v)}>Save</Button></div>}</div>;
}

// ------------------------------------------------------------------ security

export function AuditLog({ preset }: { preset?: "staff" }) {
  const [f, setF] = useState({ action: "", from: "", to: "" });
  const [before, setBefore] = useState<number[]>([]);
  const a = useAdmin();
  const params = { action: f.action || undefined, from: f.from ? new Date(f.from).toISOString() : undefined, to: f.to ? new Date(f.to + "T23:59:59").toISOString() : undefined, before: before[before.length - 1], limit: 50 };
  const q = useQuery<any>(`/api/admin/audit${qs(params)}`);
  const verify = useQuery<any>(preset ? null : "/api/admin/audit/verify");
  const [open, setOpen] = useState<any | null>(null);
  useEffect(() => setBefore([]), [f.action, f.from, f.to]);
  const rows = (q.data?.rows ?? []).filter((r: any) => preset !== "staff" || r.actor_role);
  return <div className="stack-24">
    <Head title={preset ? "Staff activity" : "Audit logs"} sub="Append-only and hash-chained. No one, including the owner, can edit or delete these records from the panel.">
      {verify.data && (verify.data.intact ? <span className="chip ok"><LuCircleCheck />Chain intact</span> : <span className="chip bad">Chain broken at #{verify.data.firstBrokenId}</span>)}
      {can(a, "audit.export") && <a className="btn sm" href={`/api/admin/audit/export${qs({ ...params, before: undefined, limit: undefined })}`}><LuDownload />Export CSV</a>}
    </Head>
    <div className="row wrap"><input className="input" style={{ width: 220 }} placeholder="Action, e.g. user.banned" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} aria-label="Action filter" />
      <label className="row small">From<input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label><label className="row small">To<input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label></div>
    <Q q={q}>{(d) => <div className="panel"><div className="table-wrap"><table className="t"><thead><tr><th>#</th><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead><tbody>
      {rows.map((r: any) => <tr key={r.id} className="click" onClick={() => setOpen(r)}><td className="mono small">{r.id}</td><td className="small">{fmtDate(r.at, true)}</td><td>{r.actor_username ?? "System"} {r.actor_role && <span className="chip">{r.actor_role}</span>}</td><td className="mono small">{r.action}</td><td>{r.target_username ?? r.target_id ?? "—"}</td><td className="small muted">{r.reason}</td></tr>)}
      {!rows.length && <tr><td colSpan={6} className="muted">No records</td></tr>}</tbody></table></div>
      <div className="spread" style={{ padding: 12 }}><Button size="sm" disabled={!before.length} onClick={() => setBefore(before.slice(0, -1))}>Newer</Button><Button size="sm" disabled={d.rows.length < 50} onClick={() => setBefore([...before, d.nextBefore])}>Older</Button></div></div>}</Q>
    {open && <Modal title={`Audit record #${open.id}`} onClose={() => setOpen(null)} wide><dl className="kv small">
      <dt>When</dt><dd>{fmtDate(open.at, true)}</dd><dt>Actor</dt><dd>{open.actor_username} · UID {open.actor_uid} · {open.actor_role} · Discord {open.actor_discord_id}</dd>
      <dt>Action</dt><dd className="mono">{open.action}</dd><dt>Target</dt><dd>{open.target_username ?? "—"} {open.target_uid ? `(UID ${open.target_uid})` : ""} {open.target_type ? `· ${open.target_type} ${open.target_id ?? ""}` : ""}</dd>
      <dt>Reason</dt><dd>{open.reason ?? "—"}</dd><dt>Before</dt><dd className="mono">{JSON.stringify(open.previous_state)}</dd><dt>After</dt><dd className="mono">{JSON.stringify(open.new_state)}</dd>
      <dt>Request</dt><dd className="mono">{open.ip} · {open.request_id}</dd><dt>Hash</dt><dd className="mono">{open.hash}</dd></dl></Modal>}
  </div>;
}

export function LoginActivity() {
  const [filter, setFilter] = useState("");
  const q = useQuery<any[]>(`/api/admin/security/logins${qs(filter === "failed" ? { success: "false" } : filter === "suspicious" ? { suspicious: "true" } : {})}`);
  return <div className="stack-24"><Head title="Login activity"><Seg label="Filter" value={filter} onChange={setFilter} options={[{ value: "", label: "All" }, { value: "failed", label: "Failed" }, { value: "suspicious", label: "New device" }]} /></Head>
    <Q q={q}>{(d) => <Table head={["When", "User", "Result", "Method", "IP", "Device"]} empty={!d.length}>{d.map((l) => <tr key={l.id}><td className="small">{fmtDate(l.at, true)}</td><td>{l.username ?? <span className="dim">{l.identifier}</span>}</td><td>{l.success ? <span className="chip ok">OK</span> : <span className="chip bad">{humanize(l.failure_reason ?? "failed")}</span>} {l.suspicious && <span className="chip warn">New device</span>}</td><td>{l.method}</td><td className="mono small">{l.ip}</td><td className="small">{l.user_agent?.slice(0, 50)}</td></tr>)}</Table>}</Q></div>;
}
export function SecurityEvents() {
  const q = useQuery<any[]>("/api/admin/security/events?limit=200");
  return <div className="stack-24"><Head title="Security events" /><Q q={q}>{(d) => <Table head={["When", "User", "Event", "Severity", "Details", "IP"]} empty={!d.length}>{d.map((e) => <tr key={e.id}><td className="small">{fmtDate(e.at, true)}</td><td>{e.username ?? "—"}</td><td>{humanize(e.kind)}</td><td><span className={`chip ${e.severity === "critical" ? "bad" : e.severity === "warning" ? "warn" : "dim"}`}>{e.severity}</span></td><td className="mono small">{JSON.stringify(e.data)}</td><td className="mono small">{e.ip}</td></tr>)}</Table>}</Q></div>;
}
export function AdminSessions() {
  const q = useQuery<any[]>("/api/admin/security/admin-sessions");
  const a = useAdmin();
  const confirm = useConfirm();
  const { run } = useAction();
  return <div className="stack-24"><Head title="Admin sessions" sub="Live admin elevations. Revoking one ends that person's admin access until they verify with Discord again." /><Q q={q}>{(d) => <Table head={["User", "Discord ID", "IP", "Started", "Expires", ""]} empty={!d.length}>{d.map((s) => <tr key={s.id}><td>{s.username}</td><td className="mono small">{s.discord_id}</td><td className="mono small">{s.ip}</td><td>{ago(s.created_at)}</td><td>{fmtDate(s.expires_at, true)}</td>
    <td>{can(a, "sessions.manage") && <Button size="sm" onClick={async () => { if (await confirm({ title: "Revoke this admin session?", danger: true })) run(() => del(`/api/admin/security/admin-sessions/${s.id}`), "Revoked").then(q.reload); }}>Revoke</Button>}</td></tr>)}</Table>}</Q></div>;
}
