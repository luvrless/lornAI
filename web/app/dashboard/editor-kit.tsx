/** @jsxRuntime automatic @jsxImportSource react */
/** Editor building blocks: bound controls, live preview, editor bar, asset fields. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LuMonitor, LuTablet, LuSmartphone, LuUndo2, LuRedo2, LuHistory, LuExternalLink, LuChevronRight, LuRotateCcw, LuImage, LuX, LuPlay } from "react-icons/lu";
import { useEditor, setPath, getPath, resetPath, undo, redo, publish, unpublish, saveNow, hasUnpublished, revertToPublished, restoreVersion, acceptRecovery, loadEditor } from "../editor-store.ts";
import { Button, ColorField, Select, Seg, Slider, Toggle, Modal, useQuery, toast, useConfirm, humanize } from "../ui.tsx";
import { post, get, fmtDate } from "../api.ts";
import { ProfileView, type Payload, type Asset } from "../../profile/ProfileView.tsx";
import { MediaPicker } from "./media.tsx";
import { useSession } from "../session.tsx";

// ------------------------------------------------------------------ media cache (library shared by pickers + preview)

let mediaCache: Record<string, Asset & { name: string; size: number; durationMs: number | null }> = {};
const mediaSubs = new Set<() => void>();
export async function refreshMedia() {
  const all: any[] = [];
  for (let off = 0; off < 2000; off += 200) {
    const r = await get(`/api/media?limit=200&offset=${off}`);
    all.push(...r.items);
    if (all.length >= r.total) break;
  }
  mediaCache = Object.fromEntries(all.map((a) => [a.id, a]));
  mediaSubs.forEach((f) => f());
}
export function addToMediaCache(a: any) { mediaCache = { ...mediaCache, [a.id]: a }; mediaSubs.forEach((f) => f()); }
export function useMedia() {
  const [m, setM] = useState(mediaCache);
  useEffect(() => { const f = () => setM(mediaCache); mediaSubs.add(f); if (!Object.keys(mediaCache).length) refreshMedia().catch(() => {}); return () => { mediaSubs.delete(f); }; }, []);
  return m;
}

// ------------------------------------------------------------------ bound controls

export function useIssue(path: string) { return useEditor((s) => s.issues[path]); }

function Ctl({ path, label, children, inline }: { path: string; label: string; children: ReactNode; inline?: boolean }) {
  const issue = useIssue(path);
  return (
    <div className="ctl" style={inline ? { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } : undefined}>
      <div className="ctl-head"><label>{label}</label>{!inline && <button className="reset" onClick={() => resetPath(path)} aria-label={`Reset ${label} to default`}>Reset</button>}</div>
      {children}
      {issue && <span className="err small" role="alert">{issue}</span>}
    </div>
  );
}

export function useVal<T = any>(path: string): T { return useEditor((s) => getPath(s.config, path)); }

export function NumCtl({ path, label, min, max, step = 1, unit }: { path: string; label: string; min: number; max: number; step?: number; unit?: string }) {
  const v = useVal<number>(path);
  return <Ctl path={path} label={label}><Slider value={v} min={min} max={max} step={step} unit={unit} label={label} onChange={(n) => setPath(path, n)} /></Ctl>;
}
export function ColorCtl({ path, label, alpha }: { path: string; label: string; alpha?: boolean }) {
  const v = useVal<string>(path);
  return <Ctl path={path} label={label}><ColorField value={v} label={label} alpha={alpha} onChange={(c) => setPath(path, c)} /></Ctl>;
}
export function SelectCtl({ path, label, options }: { path: string; label: string; options: readonly string[] }) {
  const v = useVal<string>(path);
  return <Ctl path={path} label={label}><Select value={v} options={options} label={label} onChange={(x) => setPath(path, x)} /></Ctl>;
}
export function SegCtl({ path, label, options }: { path: string; label: string; options: readonly string[] }) {
  const v = useVal<string>(path);
  return <Ctl path={path} label={label}><Seg value={v} options={options} label={label} onChange={(x) => setPath(path, x)} /></Ctl>;
}
export function BoolCtl({ path, label, hint }: { path: string; label: string; hint?: string }) {
  const v = useVal<boolean>(path);
  return (
    <div className="spread">
      <div><div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>{hint && <div className="small dim">{hint}</div>}</div>
      <Toggle checked={v} onChange={(x) => setPath(path, x)} label={label} />
    </div>
  );
}
export function TextCtl({ path, label, max, area, placeholder }: { path: string; label: string; max: number; area?: boolean; placeholder?: string }) {
  const v = useVal<string>(path);
  return (
    <Ctl path={path} label={label}>
      {area ? <textarea className="textarea" value={v} maxLength={max} placeholder={placeholder} onChange={(e) => setPath(path, e.target.value)} aria-label={label} />
        : <input className="input" value={v} maxLength={max} placeholder={placeholder} onChange={(e) => setPath(path, e.target.value)} aria-label={label} />}
      <span className="hint small dim" style={{ textAlign: "right" }}>{v.length}/{max}</span>
    </Ctl>
  );
}

export function AssetCtl({ path, label, kinds, hint }: { path: string; label: string; kinds: string[]; hint?: string }) {
  const id = useVal<string | null>(path);
  const media = useMedia();
  const [open, setOpen] = useState(false);
  const a = id ? media[id] : null;
  return (
    <Ctl path={path} label={label}>
      <div className="row">
        <div className="thumb">{a ? (a.thumbUrl ? <img src={a.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <LuPlay />) : <LuImage color="var(--dim)" />}</div>
        <div className="grow small">{a ? <><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</b><span className="dim">{a.kind}</span></> : <span className="dim">{hint ?? "None selected"}</span>}</div>
        <Button size="sm" onClick={() => setOpen(true)}>{a ? "Change" : "Choose"}</Button>
        {a && <Button size="sm" kind="ghost" icon onClick={() => setPath(path, null)} aria-label={`Remove ${label}`}><LuX /></Button>}
      </div>
      {open && <MediaPicker kinds={kinds} onClose={() => setOpen(false)} onPick={(x) => { setPath(path, x.id); setOpen(false); }} />}
    </Ctl>
  );
}

export function Section({ id, icon, title, children, open, onToggle }: { id: string; icon: ReactNode; title: string; children: ReactNode; open: boolean; onToggle: (id: string) => void }) {
  return (
    <div className="section-acc" data-open={open}>
      <button onClick={() => onToggle(id)} aria-expanded={open}>{icon}{title}<LuChevronRight className="chev" /></button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ preview

const DEVICES = { desktop: { w: 1280, h: 800 }, tablet: { w: 820, h: 1080 }, mobile: { w: 390, h: 844 } } as const;

export function usePreviewPayload(): Payload | null {
  const { me } = useSession();
  const config = useEditor((s) => s.config);
  const media = useMedia();
  const badges = useQuery<any>("/api/badges/me");
  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const widgetKey = JSON.stringify([config.widgets, config.pages.map((p) => p.widgets)]);
  useEffect(() => {
    const t = setTimeout(() => {
      post("/api/profile/preview", { config }).then((r) => setIntegrations(r.integrations)).catch(() => {});
    }, 900);
    return () => clearTimeout(t);
  }, [widgetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => me?.user ? {
    user: { uid: me.user.uid, username: me.user.username, createdAt: me.user.createdAt, premium: false, verified: false },
    config, assets: media as any, views: 0, integrations, mode: "draft",
    badges: (badges.data?.badges ?? []).filter((b: any) => !b.hidden && !b.hiddenByPlatform),
  } : null, [me, config, media, integrations, badges.data]);
}

export function Preview({ entry = "auto" }: { entry?: "auto" | "show" | "skip" }) {
  const payload = usePreviewPayload();
  const [device, setDevice] = useState<keyof typeof DEVICES>("desktop");
  const [replay, setReplay] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const d = DEVICES[device];
      setScale(Math.min(1, (el.clientWidth - 36) / d.w, (el.clientHeight - 36) / d.h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);
  const d = DEVICES[device];
  return (
    <div className="editor-preview">
      <div className="editor-bar" style={{ justifyContent: "space-between" }}>
        <Seg label="Preview device" value={device} onChange={setDevice} options={[{ value: "desktop", label: <LuMonitor aria-label="Desktop" /> }, { value: "tablet", label: <LuTablet aria-label="Tablet" /> }, { value: "mobile", label: <LuSmartphone aria-label="Mobile" /> }]} />
        <span className="small dim">{d.w}×{d.h}</span>
        <Button size="sm" kind="ghost" onClick={() => setReplay((r) => r + 1)}><LuRotateCcw />Replay animations</Button>
      </div>
      <div className="preview-stage" ref={stage}>
        <div style={{ width: d.w * scale, height: d.h * scale }}>
          <div className="device" style={{ width: d.w, height: d.h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {payload ? <ProfileView key={replay} payload={payload} mode="preview" entryPreview={entry} replayKey={replay} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ editor bar

export function SaveState() {
  const s = useEditor((x) => x.status);
  const label = { idle: "", dirty: "Unsaved changes", saving: "Saving…", saved: "Draft saved", error: "Couldn't save", conflict: "Changed elsewhere" }[s];
  return <span className={`save-state ${s === "saving" ? "saving" : s === "error" || s === "conflict" ? "error" : s === "dirty" ? "dirty" : ""}`} aria-live="polite"><i />{label}</span>;
}

export function EditorBar() {
  const s = useEditor((x) => x);
  const { me } = useSession();
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);
  const confirm = useConfirm();
  const unpub = hasUnpublished(s);
  const doPublish = async () => {
    setBusy(true);
    try { const v = await publish(); toast(`Published version ${v}`, "ok"); } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="editor-bar">
        <Button size="sm" icon kind="ghost" onClick={undo} disabled={!s.canUndo} aria-label="Undo" className="tip" data-tip="Undo (Ctrl+Z)"><LuUndo2 /></Button>
        <Button size="sm" icon kind="ghost" onClick={redo} disabled={!s.canRedo} aria-label="Redo" className="tip" data-tip="Redo (Ctrl+Shift+Z)"><LuRedo2 /></Button>
        <Button size="sm" icon kind="ghost" onClick={() => setHistory(true)} aria-label="Version history" className="tip" data-tip="Version history"><LuHistory /></Button>
        <div className="grow"><SaveState /></div>
        {me?.user && <a className="btn sm ghost icon tip" data-tip="Open public page" href={`/${me.user.username}`} target="_blank" rel="noreferrer" aria-label="Open public page"><LuExternalLink /></a>}
        <Button size="sm" kind="primary" busy={busy} onClick={doPublish} disabled={!unpub && s.isPublished}>{s.isPublished ? (unpub ? "Publish changes" : "Published") : "Publish"}</Button>
      </div>
      {s.status === "conflict" && <div className="banner warn small" style={{ margin: 12 }}>{s.error} <Button size="sm" onClick={() => loadEditor(true)}>Reload latest</Button></div>}
      {s.status === "error" && <div className="banner bad small" style={{ margin: 12 }}>{s.error} <Button size="sm" onClick={() => saveNow()}>Retry</Button></div>}
      {s.recovery && <div className="banner small" style={{ margin: 12 }}>We found unsaved edits from {fmtDate(new Date(s.recovery.at), true)}.<div className="row" style={{ marginLeft: "auto" }}><Button size="sm" onClick={() => acceptRecovery(true)}>Restore</Button><Button size="sm" kind="ghost" onClick={() => acceptRecovery(false)}>Discard</Button></div></div>}
      {s.premiumBlocked.length > 0 && <div className="banner warn small" style={{ margin: 12 }}>Needs Premium to publish: {s.premiumBlocked.join(", ")}.</div>}
      {s.moderationHidden && <div className="banner bad small" style={{ margin: 12 }}>Your profile is hidden by moderators. Check your notifications or contact support.</div>}
      {history && <VersionHistory onClose={() => setHistory(false)} onUnpublish={async () => {
        if (await confirm({ title: "Unpublish your profile?", body: "Visitors will see “not published” until you publish again. Your draft is kept.", confirm: "Unpublish", danger: true })) { await unpublish(); toast("Profile unpublished", "ok"); }
      }} isPublished={s.isPublished} hasChanges={unpub} />}
    </>
  );
}

function VersionHistory({ onClose, onUnpublish, isPublished, hasChanges }: { onClose: () => void; onUnpublish: () => void; isPublished: boolean; hasChanges: boolean }) {
  const q = useQuery<any[]>("/api/profile/versions");
  const confirm = useConfirm();
  return (
    <Modal title="Version history" onClose={onClose}>
      <p className="muted small">Every publish is saved. Restoring a version publishes it again and replaces your draft.</p>
      <div className="row wrap">
        {hasChanges && isPublished && <Button size="sm" onClick={async () => { if (await confirm({ title: "Discard unpublished changes?", body: "Your draft goes back to the currently published version.", confirm: "Discard changes", danger: true })) { await revertToPublished(); toast("Draft reverted", "ok"); onClose(); } }}><LuRotateCcw />Discard unpublished changes</Button>}
        {isPublished && <Button size="sm" kind="danger" onClick={onUnpublish}>Unpublish</Button>}
      </div>
      {q.loading ? <div className="skel" style={{ height: 80 }} /> : !q.data?.length ? <p className="muted">Nothing published yet.</p> : (
        <div className="col">
          {q.data.map((v) => (
            <div key={v.id} className="list-item">
              <div className="grow"><b>Version {v.version}</b> {v.current && <span className="chip ok">Live</span>}<div className="small dim">{fmtDate(v.created_at, true)} · {humanize(v.source)}{v.note ? ` · ${v.note}` : ""}</div></div>
              {!v.current && <Button size="sm" onClick={async () => { if (await confirm({ title: `Restore version ${v.version}?`, body: "This publishes it as a new version and replaces your current draft.", confirm: "Restore and publish" })) { await restoreVersion(v.version); toast(`Restored version ${v.version}`, "ok"); onClose(); } }}>Restore</Button>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Two-column editor page: controls on the left, live preview on the right. */
export function EditorLayout({ children, entry }: { children: ReactNode; entry?: "auto" | "show" | "skip" }) {
  const loaded = useEditor((s) => s.loaded);
  useEffect(() => { loadEditor().catch((e) => toast(e.message, "bad")); }, []);
  if (!loaded) return <div className="editor"><div className="editor-controls" style={{ padding: 20 }}><div className="skel" style={{ height: 300 }} /></div><div /></div>;
  return (
    <div className="editor">
      <div className="editor-controls"><EditorBar />{children}</div>
      <Preview entry={entry} />
    </div>
  );
}
