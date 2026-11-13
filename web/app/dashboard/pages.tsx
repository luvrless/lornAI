/** @jsxRuntime automatic @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import { LuExternalLink, LuGripVertical, LuEye, LuEyeOff, LuArrowUp, LuArrowDown, LuDownload, LuStar, LuHeart, LuTrash2, LuPlus, LuShieldCheck, LuKeyRound, LuMonitor, LuLogOut, LuMegaphone, LuCircleAlert, LuTicket, LuSend } from "react-icons/lu";
import { SiDiscord, SiGoogle } from "react-icons/si";
import { get, post, put, patch, del, qs, fmtDate, fmtMoney, fmtBytes, ago } from "../api.ts";
import { Link, navigate } from "../router.tsx";
import { Button, Stat, delta, LineChart, BarList, Copy, Empty, ErrorBlock, LoadingBlock, Modal, Seg, Select, Tabs, TextField, Toggle, ToggleRow, toast, useAction, useConfirm, useQuery, useReorder, useDebounced, humanize } from "../ui.tsx";
import { useSession } from "../session.tsx";
import { BadgeIcon } from "../../profile/ProfileView.tsx";
import { loadEditor, replaceFromServer, editorState, saveNow } from "../editor-store.ts";
import { MediaPicker } from "./media.tsx";
import { ColorField } from "../ui.tsx";

const day = (d: string) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" });

// ------------------------------------------------------------------ overview

export function Overview() {
  const q = useQuery<any>("/api/dashboard/overview");
  if (q.error) return <ErrorBlock error={q.error} retry={q.reload} />;
  if (!q.data) return <LoadingBlock rows={6} />;
  const d = q.data;
  return (
    <div className="stack-24">
      <div className="page-head">
        <div><h1>Welcome back, {d.user.displayName || d.user.username}</h1><p>Your page is {d.profile.is_published ? <>live at <a href={d.url} target="_blank" rel="noreferrer">{d.url.replace(/^https?:\/\//, "")}</a></> : "not published yet"}.</p></div>
        <div className="row"><Copy text={d.url} label="Copy link" /><a className="btn sm" href={`/${d.user.username}`} target="_blank" rel="noreferrer"><LuExternalLink />Open</a><Link className="btn sm primary" to="/dashboard/customize">Customize</Link></div>
      </div>
      {d.announcements.map((a: any) => <div key={a.id} className={`banner ${a.level === "warning" ? "warn" : a.level === "critical" ? "bad" : ""}`}><LuMegaphone /><div><b>{a.title}</b><div className="small">{a.body}</div></div></div>)}
      {!d.user.emailVerified && d.user.email && <div className="banner warn"><LuCircleAlert /><div className="grow">Verify your email so you can recover your account.</div><Button size="sm" onClick={() => post("/api/auth/resend-verification").then((r) => toast(r.status === "not_configured" ? "Email delivery isn't set up on this server yet" : "Verification email sent", r.status === "not_configured" ? "bad" : "ok")).catch((e) => toast(e.message, "bad"))}>Resend email</Button></div>}
      {d.profile.moderation_hidden && <div className="banner bad">Your profile is hidden by moderators. <Link to="/dashboard/support">Contact support</Link></div>}
      <div className="grid-4">
        <Stat k="Views, last 30 days" v={d.analytics.views30d.toLocaleString("en")} d={{ value: delta(d.analytics.views30d, d.analytics.previous.views) }} />
        <Stat k="Unique visitors" v={d.analytics.uniques30d.toLocaleString("en")} d={{ value: delta(d.analytics.uniques30d, d.analytics.previous.uniques) }} />
        <Stat k="Link clicks" v={d.analytics.clicks30d.toLocaleString("en")} d={{ value: delta(d.analytics.clicks30d, d.analytics.previous.clicks) }} />
        <Stat k="All-time views" v={d.analytics.allTime.toLocaleString("en")} />
      </div>
      <div className="grid-3">
        <div className="panel" style={{ gridColumn: "span 2" }}>
          <div className="panel-head"><h3>Views</h3><Link to="/dashboard/analytics" className="small">Full analytics</Link></div>
          <div className="panel-body"><LineChart labels={d.analytics.series.map((s: any) => day(s.day))} series={[{ name: "views", values: d.analytics.series.map((s: any) => s.views) }, { name: "clicks", values: d.analytics.series.map((s: any) => s.clicks), dashed: true }]} /></div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Profile completion</h3><b>{d.completion.percent}%</b></div>
          <div className="panel-body col">
            <div className="progress"><i style={{ width: `${d.completion.percent}%` }} /></div>
            {d.completion.checks.map((c: any) => <div key={c.label} className="row small"><span style={{ color: c.done ? "var(--ok)" : "var(--dim)" }}>{c.done ? "✓" : "○"}</span><span className={c.done ? "" : "muted"}>{c.label}</span></div>)}
          </div>
        </div>
      </div>
      <div className="grid-3">
        <div className="panel pad">
          <h3 style={{ marginBottom: 10 }}>Account</h3>
          <dl className="kv small"><dt>UID</dt><dd>{d.user.uid.toLocaleString("en")}</dd><dt>Joined</dt><dd>{fmtDate(d.createdAt)}</dd><dt>Plan</dt><dd>{d.entitlements.some((e: any) => e.kind === "premium") ? <span className="chip">Premium</span> : "Free"}</dd>
            <dt>Storage</dt><dd>{fmtBytes(d.storage.usedBytes)} of {fmtBytes(d.storage.quotaBytes)}</dd><dt>Published</dt><dd>{d.profile.published_at ? ago(d.profile.published_at) : "Never"}</dd></dl>
        </div>
        <div className="panel pad">
          <div className="spread" style={{ marginBottom: 10 }}><h3>Badges</h3><Link className="small" to="/dashboard/badges">Manage</Link></div>
          {d.badges.length ? <div className="row wrap">{d.badges.map((b: any) => <BadgeIcon key={b.id} b={b} size={26} />)}</div> : <p className="muted small">No badges yet.</p>}
        </div>
        <div className="panel pad">
          <h3 style={{ marginBottom: 10 }}>Recent activity</h3>
          {d.activity.length ? <div className="col small">{d.activity.slice(0, 6).map((a: any, i: number) => <div key={i} className="spread"><span>{a.kind === "security" ? humanize(a.what) : a.what}</span><span className="dim">{ago(a.at)}</span></div>)}</div> : <p className="muted small">Nothing yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ badges

export function Badges() {
  const q = useQuery<any>("/api/badges/me");
  const [order, setOrder] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (q.data) setOrder(q.data.badges); }, [q.data]);
  const save = async (list: any[]) => {
    setOrder(list);
    try { await put("/api/badges/me/arrangement", { order: list.map((b) => b.id), hidden: list.filter((b) => b.hidden).map((b) => b.id) }); }
    catch (e) { toast((e as Error).message, "bad"); q.reload(); }
  };
  const { bind, move } = useReorder(order, save);
  if (q.error) return <ErrorBlock error={q.error} retry={q.reload} />;
  if (!q.data) return <LoadingBlock />;
  return (
    <div className="stack-24">
      <div className="page-head"><div><h1>Badges</h1><p>Drag to choose the order on your profile, or hide any badge. Changes apply to your live page immediately.</p></div></div>
      <div className="panel pad">
        {order.length ? <div className="col">{order.map((b, i) => (
          <div key={b.id} {...bind(i)} style={{ opacity: b.hidden ? .55 : 1 }}>
            <span className="handle" aria-hidden><LuGripVertical /></span>
            <BadgeIcon b={b} size={28} />
            <div className="grow"><b>{b.name}</b><div className="small dim">{b.description || b.tooltip} · {humanize(b.rarity)} · {b.method === "purchase" ? "Purchased" : b.method === "admin_grant" ? "Granted by staff" : humanize(b.method)} {fmtDate(b.acquiredAt)}</div></div>
            <Button size="sm" kind="ghost" icon onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><LuArrowUp /></Button>
            <Button size="sm" kind="ghost" icon onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move down"><LuArrowDown /></Button>
            <Button size="sm" kind="ghost" icon onClick={() => save(order.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)))} aria-label={b.hidden ? "Show on profile" : "Hide from profile"}>{b.hidden ? <LuEyeOff /> : <LuEye />}</Button>
          </div>
        ))}</div> : <Empty title="No badges yet">Badges come from events, milestones and the community. The first 150 accounts get OG automatically.</Empty>}
      </div>
      <div className="panel pad stack-16">
        <div className="spread"><div><h3>Custom badges</h3><p className="small muted">Design your own badge. Each one uses a credit and is reviewed by staff. You have {q.data.credits} credit{q.data.credits === 1 ? "" : "s"}.</p></div>
          <div className="row"><Link className="btn sm" to="/dashboard/premium">Get credits</Link><Button size="sm" kind="primary" disabled={q.data.credits < 1} onClick={() => setCreating(true)}><LuPlus />Request a badge</Button></div></div>
        {q.data.customRequests.length > 0 && <table className="t"><thead><tr><th>Name</th><th>Status</th><th>Requested</th><th>Note</th></tr></thead><tbody>
          {q.data.customRequests.map((r: any) => <tr key={r.id}><td>{r.name}</td><td><span className={`chip ${r.status === "approved" ? "ok" : r.status === "rejected" ? "bad" : "warn"}`}>{humanize(r.status)}</span></td><td>{fmtDate(r.created_at)}</td><td className="muted">{r.review_note}</td></tr>)}
        </tbody></table>}
      </div>
      {creating && <CustomBadgeForm onClose={() => setCreating(false)} onDone={() => { setCreating(false); q.reload(); }} />}
    </div>
  );
}

function CustomBadgeForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(""); const [color, setColor] = useState("#60a5fa"); const [img, setImg] = useState<any>(null); const [pick, setPick] = useState(false);
  const { busy, run } = useAction();
  return (
    <Modal title="Request a custom badge" onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="primary" busy={busy} disabled={!name || !img} onClick={() => run(() => post("/api/badges/custom", { name, iconAssetId: img.id, color }), "Badge requested — staff will review it").then((r) => r && onDone())}>Use 1 credit and request</Button></>}>
      <TextField label="Badge name (shown as the tooltip)" value={name} onChange={setName} maxLength={30} />
      <div className="field"><label>Artwork</label><div className="row">{img && <img src={img.thumbUrl ?? img.url} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />}<Button size="sm" onClick={() => setPick(true)}>{img ? "Change image" : "Choose image"}</Button></div><span className="hint">Square PNG or WebP with a transparent background works best.</span></div>
      <div className="field"><label>Accent colour</label><ColorField value={color} onChange={setColor} label="Badge colour" /></div>
      {pick && <MediaPicker kinds={["image", "icon"]} onClose={() => setPick(false)} onPick={(a) => { setImg(a); setPick(false); }} />}
    </Modal>
  );
}

// ------------------------------------------------------------------ templates

export function Templates() {
  const [tab, setTab] = useState<"browse" | "mine" | "favorites">("browse");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"popular" | "new" | "favorites">("popular");
  const [create, setCreate] = useState(false);
  const s = useDebounced(search);
  const q = useQuery<any>(`/api/templates${qs({ kind: kind || undefined, search: s, sort, mine: tab === "mine" || undefined, favorites: tab === "favorites" || undefined, limit: 48 })}`);
  const confirm = useConfirm();
  const apply = async (t: any) => {
    const ok = await confirm({ title: `Apply “${t.name}”?`, body: `This replaces your current ${Object.keys(t.config).join(", ")} settings in your draft. Your published page doesn't change until you publish. You can undo from version history.`, confirm: "Apply to draft" });
    if (!ok) return;
    await loadEditor(); await saveNow();
    try {
      const r = await post(`/api/templates/${t.id}/apply`, { confirm: true, rev: editorState().rev });
      replaceFromServer(r.draft, r.rev);
      toast("Template applied to your draft", "ok");
      navigate("/dashboard/customize");
    } catch (e) { toast((e as Error).message, "bad"); }
  };
  return (
    <div className="stack-24">
      <div className="page-head"><div><h1>Templates</h1><p>Start from someone's look, or share your own. Templates only contain style settings — never your content or other people's files.</p></div><Button kind="primary" onClick={() => setCreate(true)}><LuPlus />Share my style</Button></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "browse", label: "Browse" }, { value: "mine", label: "My templates" }, { value: "favorites", label: "Favourites" }]} />
      <div className="row wrap">
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search by name or tag" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search templates" />
        <Select label="Type" value={kind} onChange={setKind} options={[{ value: "", label: "All types" }, ...["full", "background", "card", "typography", "animation", "effects"].map((k) => ({ value: k, label: humanize(k) }))]} />
        <Select label="Sort" value={sort} onChange={setSort} options={[{ value: "popular", label: "Most used" }, { value: "new", label: "Newest" }, { value: "favorites", label: "Most favourited" }]} />
      </div>
      {q.error ? <ErrorBlock error={q.error} retry={q.reload} /> : !q.data ? <LoadingBlock /> : !q.data.items.length ? <Empty title="No templates found">{tab === "mine" ? "Share your current style with “Share my style”." : "Try another search."}</Empty> : (
        <div className="grid-3">{q.data.items.map((t: any) => (
          <div key={t.id} className="panel pad col">
            <div style={{ height: 120, borderRadius: 12, overflow: "hidden", background: t.config.background ? `linear-gradient(135deg, ${t.config.background.effectColors?.join(",") ?? t.config.background.gradientFrom + "," + t.config.background.gradientTo})` : "var(--midnight)" }}>{t.previewUrl && <img src={t.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
            <div className="spread"><b>{t.name}</b><span className="chip dim">{humanize(t.kind)}</span></div>
            <p className="small muted" style={{ minHeight: 36 }}>{t.description || "No description"}</p>
            <div className="small dim">by {t.author} · {t.uses} uses · {t.favorites} favourites{t.mine ? ` · ${humanize(t.visibility)}` : ""}</div>
            <div className="row">
              <Button size="sm" kind="primary" onClick={() => apply(t)}>Apply</Button>
              {!t.mine && <Button size="sm" kind="ghost" onClick={() => put(`/api/templates/${t.id}/favorite`, { on: !t.favorited }).then(q.reload)} aria-label={t.favorited ? "Remove favourite" : "Favourite"}><LuHeart fill={t.favorited ? "currentColor" : "none"} /></Button>}
              {t.mine && <>
                <Select label="Visibility" value={t.visibility} onChange={(v) => patch(`/api/templates/${t.id}`, { visibility: v }).then(q.reload).catch((e) => toast(e.message, "bad"))} options={["public", "unlisted", "private"]} />
                <Button size="sm" kind="ghost" icon aria-label="Delete template" onClick={async () => { if (await confirm({ title: `Delete “${t.name}”?`, confirm: "Delete", danger: true })) { await del(`/api/templates/${t.id}`); q.reload(); } }}><LuTrash2 /></Button>
              </>}
              {t.visibility !== "private" && <Copy text={`${location.origin}/dashboard/templates?t=${t.id}`} label="Link" />}
            </div>
          </div>
        ))}</div>
      )}
      {create && <CreateTemplate onClose={() => setCreate(false)} onDone={() => { setCreate(false); setTab("mine"); q.reload(); }} />}
    </div>
  );
}

function CreateTemplate({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", description: "", kind: "full", visibility: "public", tags: "" });
  const { busy, run } = useAction();
  return (
    <Modal title="Share my style" onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="primary" busy={busy} disabled={!f.name} onClick={() => run(async () => { await saveNow(); return post("/api/templates", { ...f, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), fromDraft: true }); }, "Template saved").then((r) => r && onDone())}>Save template</Button></>}>
      <p className="small muted">Creates a template from your current draft. Your text, links and widgets are never included.</p>
      <TextField label="Name" value={f.name} onChange={(v) => setF({ ...f, name: v })} maxLength={60} />
      <TextField label="Description" value={f.description} onChange={(v) => setF({ ...f, description: v })} maxLength={500} textarea />
      <div className="grid-2">
        <div className="field"><label>What to include</label><Select value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[{ value: "full", label: "Whole look" }, { value: "background", label: "Background" }, { value: "card", label: "Card" }, { value: "typography", label: "Typography" }, { value: "animation", label: "Animations" }, { value: "effects", label: "Effects and cursor" }]} /></div>
        <div className="field"><label>Visibility</label><Select value={f.visibility} onChange={(v) => setF({ ...f, visibility: v })} options={["public", "unlisted", "private"]} /></div>
      </div>
      <TextField label="Tags" hint="Comma separated, up to 8" value={f.tags} onChange={(v) => setF({ ...f, tags: v })} />
    </Modal>
  );
}

// ------------------------------------------------------------------ integrations

export function Integrations() {
  const { me, refresh } = useSession();
  const status = useQuery<any>("/api/meta/integrations");
  const providers = useQuery<any>("/api/auth/providers");
  const confirm = useConfirm();
  const conn = (p: string) => me?.connections?.find((c) => c.provider === p);
  const disconnect = async (p: string) => {
    if (!(await confirm({ title: `Disconnect ${humanize(p)}?`, body: "You won't be able to sign in with it until you connect it again.", confirm: "Disconnect", danger: true }))) return;
    try { await del(`/api/account/connections/${p}`); await refresh(); toast("Disconnected", "ok"); } catch (e) { toast((e as Error).message, "bad"); }
  };
  return (
    <div className="stack-24">
      <div className="page-head"><div><h1>Integrations</h1><p>Connected accounts are verified through each platform's sign-in. Widgets for public profiles (GitHub, Roblox, Steam, YouTube, Twitch) pull live public data — add them in Widgets.</p></div></div>
      <div className="grid-2">
        {[["discord", SiDiscord, "#5865F2"], ["google", SiGoogle, "#e2e8f0"]].map(([p, I, color]: any) => {
          const c = conn(p);
          const available = providers.data?.[p];
          return (
            <div key={p} className="panel pad row">
              <I style={{ width: 28, height: 28, color }} />
              <div className="grow"><b>{humanize(p)}</b><div className="small muted">{c ? `Connected as ${c.username ?? c.providerUserId} · since ${fmtDate(c.linkedAt)}` : available === false ? "Not configured on this server" : "Not connected"}</div></div>
              {c ? <Button size="sm" onClick={() => disconnect(p)}>Disconnect</Button> : available ? <a className="btn sm primary" href={`/api/auth/${p}/start?intent=link`}>Connect</a> : null}
            </div>
          );
        })}
      </div>
      <div className="panel">
        <div className="panel-head"><h3>Widget data sources</h3></div>
        <div className="table-wrap"><table className="t"><tbody>
          {status.data && Object.entries(status.data).map(([k, v]: any) => <tr key={k}><td style={{ width: 160 }}><b>{humanize(k)}</b></td><td>{String(v).startsWith("not_configured") ? <span className="chip warn">Not available</span> : <span className="chip ok">Available</span>}</td><td className="muted small">{String(v).replace(/^not_configured: /, "Server needs ")}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ analytics

export function Analytics() {
  const [range, setRange] = useState<"7" | "30" | "90" | "365">("30");
  const { from, to } = useMemo(() => ({ to: new Date(), from: new Date(Date.now() - Number(range) * 86400_000) }), [range]);
  const q = useQuery<any>(`/api/analytics${qs({ from: from.toISOString(), to: to.toISOString() })}`);
  const ed = useQuery<any>("/api/profile/editor");
  const linkName = (id: string) => { const l = ed.data?.draft.links.find((x: any) => x.id === id); return l ? (l.title || humanize(l.platform)) : "Removed link"; };
  const trackName = (id: string) => ed.data?.draft.music.tracks.find((x: any) => x.id === id)?.title ?? "Removed track";
  const d = q.data;
  return (
    <div className="stack-24">
      <div className="page-head">
        <div><h1>Analytics</h1><p>Counted from real visits. Bots, your own visits and repeat views within 30 minutes aren't counted.</p></div>
        <div className="row"><Seg label="Date range" value={range} onChange={setRange} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "365", label: "1 year" }]} />
          <a className="btn sm" href={`/api/analytics/export${qs({ from: from.toISOString(), to: to.toISOString() })}`}><LuDownload />Export CSV</a></div>
      </div>
      {q.error ? <ErrorBlock error={q.error} retry={q.reload} /> : !d ? <LoadingBlock rows={6} /> : <>
        <div className="grid-4">
          <Stat k="Views" v={d.totals.views.toLocaleString("en")} d={{ value: delta(d.totals.views, d.previous.views) }} />
          <Stat k="Unique visitors" v={d.totals.uniques.toLocaleString("en")} d={{ value: delta(d.totals.uniques, d.previous.uniques) }} />
          <Stat k="Link clicks" v={d.totals.clicks.toLocaleString("en")} d={{ value: delta(d.totals.clicks, d.previous.clicks) }} />
          <Stat k="Click-through rate" v={`${(d.totals.ctr * 100).toFixed(1)}%`} />
        </div>
        <div className="panel"><div className="panel-head"><h3>Views and visitors</h3><span className="small dim">{d.totals.plays} music plays</span></div><div className="panel-body">
          <LineChart labels={d.series.map((s: any) => day(s.day))} series={[{ name: "views", values: d.series.map((s: any) => s.views) }, { name: "visitors", values: d.series.map((s: any) => s.uniques), dashed: true }]} />
        </div></div>
        <div className="grid-2">
          <div className="panel"><div className="panel-head"><h3>Links</h3></div><div className="table-wrap"><table className="t"><thead><tr><th>Link</th><th>Clicks</th><th>Unique</th><th>CTR</th></tr></thead><tbody>
            {d.links.map((l: any) => <tr key={l.link_id}><td>{linkName(l.link_id)}</td><td>{l.clicks}</td><td>{l.uniques}</td><td>{(l.ctr * 100).toFixed(1)}%</td></tr>)}
            {!d.links.length && <tr><td colSpan={4} className="muted">No clicks in this period</td></tr>}
          </tbody></table></div></div>
          <div className="panel pad"><h3 style={{ marginBottom: 12 }}>Traffic sources</h3><BarList items={d.referrers} /></div>
          <div className="panel pad"><h3 style={{ marginBottom: 12 }}>Devices</h3><BarList items={d.devices} /><h3 style={{ margin: "18px 0 12px" }}>Browsers</h3><BarList items={d.browsers} /><h3 style={{ margin: "18px 0 12px" }}>Operating systems</h3><BarList items={d.os} /></div>
          <div className="panel pad"><h3 style={{ marginBottom: 12 }}>Countries</h3><BarList items={d.countries} empty="Country data needs a CDN or proxy that reports visitor country" />
            <h3 style={{ margin: "18px 0 12px" }}>Campaigns</h3>
            {d.campaigns.length ? <BarList items={d.campaigns.map((c: any) => ({ name: [c.campaign, c.source, c.medium].filter(Boolean).join(" / "), n: c.n }))} /> : <p className="small muted">Add ?utm_source=…&utm_campaign=… to your link to track campaigns.</p>}
            <h3 style={{ margin: "18px 0 12px" }}>Music</h3><BarList items={d.plays.map((p: any) => ({ name: trackName(p.track_id), n: p.n }))} empty="No plays in this period" />
          </div>
        </div>
      </>}
    </div>
  );
}

// ------------------------------------------------------------------ share

export function Share() {
  const { me } = useSession();
  const [color, setColor] = useState("#020617");
  const [utm, setUtm] = useState(false);
  if (!me?.user) return null;
  const url = `${location.origin}/${me.user.username}`;
  const qr = `/api/p/${me.user.username}/qr.svg${qs({ color, utm: utm ? 1 : undefined })}`;
  const share = async () => { if (navigator.share) await navigator.share({ title: me.user!.username, url }).catch(() => {}); else { await navigator.clipboard.writeText(url); toast("Link copied", "ok"); } };
  return (
    <div className="stack-24">
      <div className="page-head"><div><h1>Share</h1><p>Your link, QR code and how your page looks when shared.</p></div></div>
      <div className="grid-2">
        <div className="panel pad stack-16">
          <h3>Your link</h3>
          <div className="input-affix"><span>{location.host}/</span><input className="input" readOnly value={me.user.username} aria-label="Profile link" /></div>
          <div className="row wrap"><Copy text={url} label="Copy link" /><Button size="sm" onClick={share}>Share…</Button><a className="btn sm" href={url} target="_blank" rel="noreferrer"><LuExternalLink />Open</a></div>
          <div className="row wrap small">
            {[["X", `https://x.com/intent/post?url=${encodeURIComponent(url)}`], ["Reddit", `https://www.reddit.com/submit?url=${encodeURIComponent(url)}`], ["Telegram", `https://t.me/share/url?url=${encodeURIComponent(url)}`], ["WhatsApp", `https://wa.me/?text=${encodeURIComponent(url)}`]].map(([n, h]) => <a key={n} className="btn sm ghost" href={h} target="_blank" rel="noreferrer">{n}</a>)}
          </div>
          <h3>Link preview</h3>
          <p className="small muted">Set the title, description, preview image and tab icon in Profile → Sharing and search.</p>
          <Link className="btn sm" to="/dashboard/profile">Edit sharing settings</Link>
        </div>
        <div className="panel pad stack-16">
          <h3>QR code</h3>
          <div style={{ background: "#fff", borderRadius: 14, padding: 12, width: 232 }}><img src={qr} alt={`QR code for ${url}`} width={208} height={208} /></div>
          <div className="row wrap"><ColorField value={color} onChange={setColor} label="QR colour" /><label className="row small"><Toggle checked={utm} onChange={setUtm} label="Track scans" />Track scans as a campaign</label></div>
          <a className="btn sm" href={qr} download={`lorn-${me.user.username}-qr.svg`}><LuDownload />Download SVG</a>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ account settings

export function AccountSettings() {
  const { me, refresh } = useSession();
  const [username, setUsername] = useState(me?.user?.username ?? "");
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [del1, setDel1] = useState(""); const [delPw, setDelPw] = useState("");
  const hist = useQuery<any[]>("/api/account/username-history");
  const { busy, run } = useAction();
  const confirm = useConfirm();
  if (!me?.user) return null;
  return (
    <div className="stack-24" style={{ maxWidth: 760 }}>
      <div className="page-head"><div><h1>Account settings</h1></div></div>
      <div className="panel pad stack-16">
        <h3>Username</h3>
        <div className="row"><div className="input-affix grow"><span>lorn.lol/</span><input className="input" value={username} maxLength={12} onChange={(e) => setUsername(e.target.value)} aria-label="Username" /></div>
          <Button busy={busy} disabled={username === me.user.username} onClick={() => run(() => post("/api/account/username", { username }), "Username changed").then(async (r) => { if (r) { await refresh(); hist.reload(); } })}>Change</Button></div>
        <p className="small dim">You can change it once every 7 days. Your old name becomes available to others.</p>
        {hist.data && hist.data.length > 1 && <div className="small muted">Previous: {hist.data.filter((h) => h.old_username).map((h) => `${h.old_username} (${fmtDate(h.changed_at)})`).join(", ")}</div>}
      </div>
      <div className="panel pad stack-16">
        <h3>Email</h3>
        <p className="small">{me.user.email ?? "No email"} {me.user.email && (me.user.emailVerified ? <span className="chip ok">Verified</span> : <span className="chip warn">Unverified</span>)}</p>
        <div className="grid-2"><TextField label="New email" type="email" value={email} onChange={setEmail} />{me.user.hasPassword && <TextField label="Current password" type="password" value={pw} onChange={setPw} />}</div>
        <Button busy={busy} disabled={!email} onClick={() => run(() => post("/api/account/email", { email, password: pw || null })).then((r) => r && toast(r.status === "not_configured" ? "Email delivery isn't set up on this server, so the confirmation can't be sent yet" : `Check ${email} to confirm the change`, r.status === "not_configured" ? "bad" : "ok"))}>Send confirmation</Button>
      </div>
      <div className="panel pad stack-16" style={{ borderColor: "rgba(255,107,122,.3)" }}>
        <h3>Delete account</h3>
        <p className="small muted">Deletes your profile, files and connections. Your username becomes available again. Your UID ({me.user.uid}) is retired and never reused. This can't be undone.</p>
        <div className="grid-2"><TextField label="Type your username" value={del1} onChange={setDel1} />{me.user.hasPassword && <TextField label="Password" type="password" value={delPw} onChange={setDelPw} />}</div>
        <Button kind="danger" disabled={del1 !== me.user.username} onClick={async () => {
          if (!(await confirm({ title: "Delete your account permanently?", body: "Everything is removed and you'll be signed out.", confirm: "Delete my account", danger: true }))) return;
          const r = await run(() => post("/api/account/delete", { confirmUsername: del1, password: delPw || null }));
          if (r) { await refresh(); navigate("/"); toast("Your account was deleted", "ok"); }
        }}>Delete account</Button>
      </div>
    </div>
  );
}

export function Security() {
  const { me, refresh } = useSession();
  const sessions = useQuery<any[]>("/api/account/sessions");
  const logins = useQuery<any[]>("/api/account/login-history");
  const [cur, setCur] = useState(""); const [nw, setNw] = useState("");
  const [setup, setSetup] = useState<any>(null); const [code, setCode] = useState(""); const [codes, setCodes] = useState<string[] | null>(null);
  const [disable, setDisable] = useState(false);
  const { busy, run } = useAction();
  if (!me?.user) return null;
  return (
    <div className="stack-24" style={{ maxWidth: 900 }}>
      <div className="page-head"><div><h1>Security</h1></div></div>
      <div className="panel pad stack-16">
        <h3><LuKeyRound /> Password</h3>
        <div className="grid-2">{me.user.hasPassword && <TextField label="Current password" type="password" value={cur} onChange={setCur} autoComplete="current-password" />}<TextField label="New password" type="password" value={nw} onChange={setNw} autoComplete="new-password" hint="At least 8 characters" /></div>
        <Button busy={busy} disabled={nw.length < 8} onClick={() => run(() => post("/api/account/password", { current: cur || null, next: nw }), "Password updated. Other devices were signed out.").then((r) => { if (r) { setCur(""); setNw(""); sessions.reload(); refresh(); } })}>{me.user.hasPassword ? "Change password" : "Set a password"}</Button>
      </div>
      <div className="panel pad stack-16">
        <div className="spread"><h3><LuShieldCheck /> Two-factor authentication</h3>{me.user.twoFactor ? <span className="chip ok">On</span> : <span className="chip dim">Off</span>}</div>
        {me.user.twoFactor ? <>
          <p className="small muted">Sign-ins ask for a code from your authenticator app.</p>
          <div className="row"><Button size="sm" onClick={() => setDisable(true)}>Turn off</Button><Button size="sm" onClick={async () => { const c = prompt("Enter a code from your authenticator app to create new recovery codes"); if (c) { const r = await run(() => post("/api/account/2fa/recovery-codes", { code: c })); if (r) setCodes(r.recoveryCodes); } }}>New recovery codes</Button></div>
        </> : !setup ? <Button kind="primary" size="sm" onClick={() => run(() => post("/api/account/2fa/setup")).then((r) => r && setSetup(r))}>Set up</Button> : (
          <div className="stack-16">
            <p className="small">Add this key to your authenticator app (1Password, Google Authenticator, Authy…), then enter the 6-digit code it shows.</p>
            <div className="row wrap"><img alt="QR code for your authenticator" src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvgClient(setup.otpauthUrl))}`} width={168} height={168} style={{ background: "#fff", borderRadius: 10, padding: 6 }} /><div className="col"><code className="mono" style={{ wordBreak: "break-all" }}>{setup.secret}</code><Copy text={setup.secret} label="Copy key" /></div></div>
            <div className="row"><input className="input" style={{ maxWidth: 160 }} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" aria-label="Authenticator code" /><Button kind="primary" busy={busy} onClick={() => run(() => post("/api/account/2fa/enable", { code })).then((r) => { if (r) { setCodes(r.recoveryCodes); setSetup(null); refresh(); } })}>Turn on</Button></div>
          </div>
        )}
      </div>
      <div className="panel">
        <div className="panel-head"><h3><LuMonitor /> Active sessions</h3><Button size="sm" onClick={() => run(() => post("/api/account/sessions/revoke-others"), "Signed out of other devices").then(() => sessions.reload())}>Sign out everywhere else</Button></div>
        <div className="table-wrap"><table className="t"><thead><tr><th>Device</th><th>Method</th><th>IP</th><th>Last active</th><th /></tr></thead><tbody>
          {(sessions.data ?? []).map((s) => <tr key={s.id}><td className="small">{uaShort(s.user_agent)} {s.current && <span className="chip ok">This device</span>}</td><td>{humanize(s.auth_method)}</td><td className="mono">{s.ip}</td><td>{ago(s.last_seen_at)}</td>
            <td>{!s.current && <Button size="sm" kind="ghost" onClick={() => del(`/api/account/sessions/${s.id}`).then(() => { sessions.reload(); toast("Session ended", "ok"); })}><LuLogOut />Sign out</Button>}</td></tr>)}
        </tbody></table></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h3>Sign-in history</h3></div>
        <div className="table-wrap"><table className="t"><thead><tr><th>When</th><th>Result</th><th>Method</th><th>IP</th><th>Device</th></tr></thead><tbody>
          {(logins.data ?? []).slice(0, 30).map((l, i) => <tr key={i}><td>{fmtDate(l.at, true)}</td><td>{l.success ? <span className="chip ok">Signed in</span> : <span className="chip bad">{humanize(l.failure_reason ?? "failed")}</span>} {l.suspicious && <span className="chip warn">New device</span>}</td><td>{humanize(l.method)}</td><td className="mono">{l.ip}</td><td className="small">{uaShort(l.user_agent)}</td></tr>)}
        </tbody></table></div>
      </div>
      {codes && <Modal title="Save your recovery codes" onClose={() => setCodes(null)} footer={<><Copy text={codes.join("\n")} label="Copy all" /><Button kind="primary" onClick={() => setCodes(null)}>I've saved them</Button></>}>
        <p className="small muted">Each code works once if you lose your authenticator. They won't be shown again.</p>
        <div className="grid-2 mono">{codes.map((c) => <code key={c}>{c}</code>)}</div>
      </Modal>}
      {disable && <DisableMfa hasPassword={me.user.hasPassword} onClose={() => setDisable(false)} onDone={() => { setDisable(false); refresh(); }} />}
    </div>
  );
}

function DisableMfa({ hasPassword, onClose, onDone }: { hasPassword: boolean; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState(""); const [code, setCode] = useState("");
  const { busy, run } = useAction();
  return (
    <Modal title="Turn off two-factor?" onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="danger" busy={busy} onClick={() => run(() => post("/api/account/2fa/disable", { password: pw || null, code }), "Two-factor turned off").then((r) => r !== undefined && onDone())}>Turn off</Button></>}>
      {hasPassword && <TextField label="Password" type="password" value={pw} onChange={setPw} />}
      <TextField label="Authenticator or recovery code" value={code} onChange={setCode} />
    </Modal>
  );
}

const uaShort = (ua: string | null) => {
  if (!ua) return "Unknown device";
  const b = /(Edg|OPR|Firefox|Chrome|Safari)\//.exec(ua)?.[1]?.replace("Edg", "Edge").replace("OPR", "Opera") ?? "Browser";
  const o = /(Windows|Mac OS X|Android|iPhone|iPad|Linux|CrOS)/.exec(ua)?.[1]?.replace("Mac OS X", "macOS").replace("CrOS", "ChromeOS") ?? "";
  return `${b}${o ? ` on ${o}` : ""}`;
};

import { qrSvg } from "../../../shared/qr.ts";
const qrSvgClient = (t: string) => qrSvg(t, { size: 168, margin: 2 });

export function Notifications() {
  const q = useQuery<any[]>("/api/account/notifications");
  const prefs = useQuery<any>("/api/account/notification-prefs");
  const setPref = (k: string, v: boolean) => patch("/api/account/notification-prefs", { [k]: v }).then(prefs.setData).catch((e) => toast(e.message, "bad"));
  return (
    <div className="stack-24" style={{ maxWidth: 820 }}>
      <div className="page-head"><div><h1>Notifications</h1></div>{q.data?.some((n) => !n.read_at) && <Button size="sm" onClick={() => post("/api/account/notifications/read").then(q.reload)}>Mark all as read</Button>}</div>
      <div className="panel pad stack-16">
        <h3>Preferences</h3>
        {prefs.data && <>
          <ToggleRow label="Security emails" hint="New sign-ins, password and email changes. Strongly recommended." checked={prefs.data.email_security} onChange={(v) => setPref("emailSecurity", v)} />
          <ToggleRow label="Product emails" hint="Events, new features and badges." checked={prefs.data.email_product} onChange={(v) => setPref("emailProduct", v)} />
          <ToggleRow label="In-app notifications" checked={prefs.data.inapp_all} onChange={(v) => setPref("inappAll", v)} />
        </>}
      </div>
      <div className="panel">
        {q.data?.length ? q.data.map((n) => (
          <div key={n.id} className="panel-head" style={{ alignItems: "flex-start", opacity: n.read_at ? .65 : 1 }}>
            <div><b>{n.title}</b>{n.body && <div className="small muted">{n.body}</div>}</div><span className="small dim" style={{ whiteSpace: "nowrap" }}>{ago(n.created_at)}</span>
          </div>
        )) : <Empty title="You're all caught up" />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ premium

export function Premium() {
  const q = useQuery<any>("/api/billing");
  const { busy, run } = useAction();
  const confirm = useConfirm();
  if (q.error) return <ErrorBlock error={q.error} retry={q.reload} />;
  if (!q.data) return <LoadingBlock />;
  const d = q.data;
  const params = new URLSearchParams(location.search);
  return (
    <div className="stack-24" style={{ maxWidth: 980 }}>
      <div className="page-head"><div><h1>Premium and purchases</h1><p>Video backgrounds, music and the full editor are free. Premium adds custom fonts and cursors, more pages and tracks, and more storage.</p></div></div>
      {params.get("checkout") === "success" && <div className="banner">Thanks! Your purchase activates as soon as the payment provider confirms it — usually within a few seconds. <Button size="sm" onClick={q.reload}>Refresh</Button></div>}
      {String(d.provider).startsWith("not_configured") && <div className="banner warn small">Payments aren't set up on this server yet, so purchases are unavailable.</div>}
      <div className="grid-3">{d.products.map((p: any) => (
        <div key={p.key} className="panel pad col">
          <h3>{p.name}</h3>
          <div style={{ font: "600 28px var(--font-display)" }}>{fmtMoney(p.price_cents, p.currency)}<span className="small muted">{p.billing === "monthly" ? " / month" : " once"}</span></div>
          <p className="small muted grow">{p.description}</p>
          <Button kind="primary" busy={busy} disabled={!p.available} onClick={() => run(() => post("/api/billing/checkout", { product: p.key })).then((r) => { if (r?.url) location.href = r.url; })}>{p.available ? "Buy" : p.unavailableReason}</Button>
        </div>
      ))}</div>
      <div className="grid-2">
        <div className="panel pad stack-16">
          <h3>Your plan</h3>
          <dl className="kv small">
            <dt>Premium</dt><dd>{d.premium ? <span className="chip ok">Active</span> : "Not active"}</dd>
            <dt>Verified</dt><dd>{d.verified ? <span className="chip ok">Yes</span> : "No"}</dd>
            <dt>Badge credits</dt><dd>{d.badgeCredits}</dd>
            {d.subscription && <><dt>Subscription</dt><dd>{humanize(d.subscription.status)}{d.subscription.cancel_at_period_end ? " · ends" : " · renews"} {fmtDate(d.subscription.current_period_end)}</dd></>}
          </dl>
          {d.subscription?.status === "active" && !d.subscription.cancel_at_period_end && <Button size="sm" onClick={async () => { if (await confirm({ title: "Cancel Premium?", body: "You keep Premium until the end of the current period.", confirm: "Cancel subscription", danger: true })) run(() => post("/api/billing/cancel"), "Subscription will end at the period end").then(q.reload); }}>Cancel subscription</Button>}
        </div>
        <div className="panel"><div className="panel-head"><h3>Purchase history</h3></div><div className="table-wrap"><table className="t"><tbody>
          {d.purchases.map((p: any) => <tr key={p.id}><td>{p.name}</td><td>{fmtMoney(p.amount_cents, p.currency)}</td><td><span className={`chip ${p.status === "paid" ? "ok" : p.status.includes("refund") ? "warn" : "dim"}`}>{humanize(p.status)}</span></td><td className="small dim">{fmtDate(p.created_at)}</td></tr>)}
          {!d.purchases.length && <tr><td className="muted">No purchases yet</td></tr>}
        </tbody></table></div></div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ support

export function Support() {
  const q = useQuery<any[]>("/api/support/tickets");
  const reports = useQuery<any[]>("/api/reports/mine");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reporting, setReporting] = useState(false);
  return (
    <div className="stack-24" style={{ maxWidth: 980 }}>
      <div className="page-head"><div><h1>Support</h1><p>Ask for help or report a profile that breaks the rules.</p></div><div className="row"><Button onClick={() => setReporting(true)}>Report a profile</Button><Button kind="primary" onClick={() => setCreating(true)}><LuTicket />New ticket</Button></div></div>
      <div className="panel"><div className="panel-head"><h3>Your tickets</h3></div><div className="table-wrap"><table className="t"><tbody>
        {(q.data ?? []).map((t) => <tr key={t.id} className="click" onClick={() => setOpen(t.id)}><td>#{t.number}</td><td><b>{t.subject}</b></td><td>{humanize(t.category)}</td><td><span className={`chip ${t.status === "closed" ? "dim" : t.status === "awaiting_user" ? "warn" : ""}`}>{t.status === "awaiting_user" ? "Waiting for you" : t.status === "awaiting_staff" ? "Waiting for staff" : humanize(t.status)}</span></td><td className="small dim">{ago(t.updated_at)}</td></tr>)}
        {q.data?.length === 0 && <tr><td className="muted">No tickets</td></tr>}
      </tbody></table></div></div>
      {reports.data && reports.data.length > 0 && <div className="panel"><div className="panel-head"><h3>Your reports</h3></div><div className="table-wrap"><table className="t"><tbody>
        {reports.data.map((r) => <tr key={r.id}><td>{r.target ?? "—"}</td><td>{humanize(r.category)}</td><td><span className="chip">{humanize(r.status)}</span></td><td className="small muted">{r.resolution}</td><td className="small dim">{fmtDate(r.created_at)}</td></tr>)}
      </tbody></table></div></div>}
      {creating && <NewTicket onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); q.reload(); setOpen(id); }} />}
      {reporting && <ReportForm onClose={() => { setReporting(false); reports.reload(); }} />}
      {open && <TicketThread id={open} onClose={() => { setOpen(null); q.reload(); }} />}
    </div>
  );
}

function NewTicket({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState({ category: "account", subject: "", body: "" });
  const [files, setFiles] = useState<any[]>([]); const [pick, setPick] = useState(false);
  const { busy, run } = useAction();
  return (
    <Modal title="New support ticket" onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="primary" busy={busy} disabled={f.subject.length < 3 || f.body.length < 10} onClick={() => run(() => post("/api/support/tickets", { ...f, attachmentIds: files.map((x) => x.id) }), "Ticket sent").then((r) => r && onDone(r.id))}><LuSend />Send</Button></>}>
      <div className="field"><label>Topic</label><Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={["account", "billing", "profile", "bug", "report", "other"]} /></div>
      <TextField label="Subject" value={f.subject} onChange={(v) => setF({ ...f, subject: v })} maxLength={120} />
      <TextField label="What's going on?" value={f.body} onChange={(v) => setF({ ...f, body: v })} textarea maxLength={8000} hint="At least 10 characters" />
      <div className="row wrap">{files.map((x) => <span key={x.id} className="chip">{x.name}</span>)}<Button size="sm" onClick={() => setPick(true)} disabled={files.length >= 5}>Attach a file</Button></div>
      {pick && <MediaPicker kinds={["image", "video"]} onClose={() => setPick(false)} onPick={(a) => { setFiles([...files, a]); setPick(false); }} />}
    </Modal>
  );
}

function TicketThread({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery<any>(`/api/support/tickets/${id}`);
  const [msg, setMsg] = useState("");
  const { busy, run } = useAction();
  const t = q.data;
  return (
    <Modal title={t ? `#${t.number} · ${t.subject}` : "Ticket"} onClose={onClose} wide footer={t && t.status !== "closed" ? <><Button kind="ghost" onClick={() => run(() => post(`/api/support/tickets/${id}/close`), "Ticket closed").then(onClose)}>Close ticket</Button></> : undefined}>
      {!t ? <LoadingBlock /> : <>
        <div className="col">{t.messages.map((m: any) => (
          <div key={m.id} className="inset" style={{ padding: 12, borderColor: m.from_staff ? "rgba(79,140,255,.35)" : undefined }}>
            <div className="spread small"><b>{m.from_staff ? `${m.author} · Staff` : m.author}</b><span className="dim">{fmtDate(m.at, true)}</span></div>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{m.body}</p>
            {m.attachments.map((a: any) => <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="small">{a.name}</a>)}
          </div>
        ))}</div>
        {t.status !== "closed" ? <div className="row" style={{ alignItems: "flex-end" }}><textarea className="textarea grow" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a reply" aria-label="Reply" maxLength={8000} /><Button kind="primary" busy={busy} disabled={!msg.trim()} onClick={() => run(() => post(`/api/support/tickets/${id}/messages`, { body: msg })).then(() => { setMsg(""); q.reload(); })}>Send</Button></div> : <p className="muted small">This ticket is closed.</p>}
      </>}
    </Modal>
  );
}

export function ReportForm({ onClose, username = "" }: { onClose: () => void; username?: string }) {
  const [f, setF] = useState({ username, category: "impersonation", description: "", url: "" });
  const { busy, run } = useAction();
  return (
    <Modal title="Report a profile" onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="danger" busy={busy} disabled={!f.username || f.description.length < 10} onClick={() => run(() => post("/api/reports", { targetType: "profile", username: f.username, category: f.category, description: f.description, evidenceUrls: f.url ? [f.url] : [] }), "Report sent. Our team will review it.").then((r) => r && onClose())}>Send report</Button></>}>
      <TextField label="Username" value={f.username} onChange={(v) => setF({ ...f, username: v })} maxLength={12} />
      <div className="field"><label>Reason</label><Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={["impersonation", "harassment", "inappropriate", "malicious_links", "copyright", "spam", "other"]} /></div>
      <TextField label="Details" value={f.description} onChange={(v) => setF({ ...f, description: v })} textarea maxLength={4000} hint="At least 10 characters" />
      <TextField label="Evidence link (optional)" value={f.url} onChange={(v) => setF({ ...f, url: v })} placeholder="https://" />
    </Modal>
  );
}

export { LuStar, LuEye, get };
