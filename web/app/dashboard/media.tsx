/** @jsxRuntime automatic @jsxImportSource react */
import { useCallback, useEffect, useRef, useState } from "react";
import { LuUpload, LuFolder, LuTrash2, LuPencil, LuRefreshCw, LuPlay, LuMusic, LuType, LuMousePointer2, LuSearch, LuPlus, LuImage, LuFilm } from "react-icons/lu";
import { uploadFile, fmtBytes, fmtDate, del, patch, post, qs, type UploadedAsset } from "../api.ts";
import { Button, Modal, Select, Seg, Empty, ErrorBlock, useQuery, useConfirm, toast, useDebounced, Pager } from "../ui.tsx";
import { addToMediaCache, refreshMedia } from "./editor-kit.tsx";

const ACCEPT: Record<string, string> = {
  image: "image/png,image/jpeg,image/webp,image/gif,image/avif", video: "video/mp4,video/webm,video/quicktime",
  audio: "audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/flac,audio/webm,.m4a", font: ".woff2,.woff,.ttf,.otf",
  cursor: "image/png,image/webp,image/gif", icon: "image/png,image/jpeg,image/webp,image/gif",
};
const KIND_ICON: Record<string, any> = { image: LuImage, video: LuFilm, audio: LuMusic, font: LuType, cursor: LuMousePointer2, icon: LuImage };

interface Job { name: string; progress: number; error?: string; done?: boolean }

export function useUploader(onDone: (a: UploadedAsset) => void) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const upload = useCallback(async (files: File[], o: { kind?: string; folderId?: string | null; replaceAssetId?: string } = {}) => {
    const base = Date.now();
    setJobs((j) => [...j, ...files.map((f) => ({ name: f.name, progress: 0 }))]);
    await Promise.all(files.map(async (f, i) => {
      const key = (x: Job[]) => x.findIndex((j) => j.name === f.name && !j.done && !j.error);
      try {
        const a = await uploadFile(f, { ...o, onProgress: (p) => setJobs((x) => { const k = key(x); if (k < 0) return x; const n = [...x]; n[k] = { ...n[k], progress: p }; return n; }) });
        setJobs((x) => { const k = key(x); if (k < 0) return x; const n = [...x]; n[k] = { ...n[k], progress: 1, done: true }; return n; });
        addToMediaCache(a);
        onDone(a);
      } catch (e) {
        setJobs((x) => { const k = key(x); if (k < 0) return x; const n = [...x]; n[k] = { ...n[k], error: (e as Error).message }; return n; });
      }
      void base; void i;
    }));
    setTimeout(() => setJobs((x) => x.filter((j) => !j.done)), 2500);
  }, [onDone]);
  return { jobs, upload, clear: () => setJobs([]) };
}

export function Dropzone({ onFiles, accept, multiple = true, children }: { onFiles: (f: File[]) => void; accept?: string; multiple?: boolean; children?: React.ReactNode }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={`dropzone ${over ? "active" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = [...e.dataTransfer.files]; if (f.length) onFiles(multiple ? f : f.slice(0, 1)); }}>
      <LuUpload style={{ width: 22, height: 22 }} />
      <div style={{ marginTop: 6 }}>{children ?? "Drop files here or"} <Button size="sm" onClick={() => input.current?.click()}>Browse</Button></div>
      <input ref={input} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) onFiles(f); }} />
    </div>
  );
}

export function UploadList({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) return null;
  return <div className="col">{jobs.map((j, i) => (
    <div key={i} className="small">
      <div className="spread"><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.name}</span><span className={j.error ? "" : "dim"} style={j.error ? { color: "var(--bad)" } : undefined}>{j.error ?? (j.done ? "Uploaded" : `${Math.round(j.progress * 100)}%`)}</span></div>
      {!j.error && <div className="progress" style={{ marginTop: 4 }}><i style={{ width: `${j.progress * 100}%` }} /></div>}
    </div>
  ))}</div>;
}

function Tile({ a, selected, onClick }: { a: any; selected?: boolean; onClick: () => void }) {
  const Icon = KIND_ICON[a.kind] ?? LuImage;
  return (
    <button className="media-tile" aria-pressed={!!selected} onClick={onClick} title={a.name}>
      <div className="pic">{a.thumbUrl ? <img src={a.thumbUrl} alt="" loading="lazy" /> : <Icon style={{ width: 28, height: 28, color: "var(--dim)" }} />}{a.kind === "video" && <LuPlay style={{ position: "absolute", top: 8, right: 8 }} />}</div>
      <div className="meta"><b>{a.name}</b><span className="dim">{a.kind} · {fmtBytes(a.size)}{a.durationMs ? ` · ${Math.round(a.durationMs / 1000)}s` : ""}</span></div>
    </button>
  );
}

/** Modal used by every file field in the editor. */
export function MediaPicker({ kinds, onPick, onClose }: { kinds: string[]; onPick: (a: any) => void; onClose: () => void }) {
  const [kind, setKind] = useState(kinds[0]);
  const [search, setSearch] = useState("");
  const s = useDebounced(search);
  const q = useQuery<any>(`/api/media${qs({ kind, search: s, limit: 120 })}`);
  const up = useUploader((a) => { q.reload(); if (kinds.includes(a.kind)) onPick(a); });
  return (
    <Modal title="Choose a file" onClose={onClose} wide>
      <div className="row wrap">
        {kinds.length > 1 && <Seg label="File type" value={kind} onChange={setKind} options={kinds} />}
        <div className="input-affix grow" style={{ minWidth: 200 }}><span><LuSearch /></span><input className="input" placeholder="Search your files" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <Dropzone accept={ACCEPT[kind]} onFiles={(f) => up.upload(f, { kind: kind === "cursor" || kind === "icon" ? kind : undefined })}>Upload a new {kind} —</Dropzone>
      <UploadList jobs={up.jobs} />
      {q.error ? <ErrorBlock error={q.error} retry={q.reload} /> : q.loading && !q.data ? <div className="skel" style={{ height: 160 }} /> :
        q.data.items.length ? <div className="media-grid">{q.data.items.map((a: any) => <Tile key={a.id} a={a} onClick={() => onPick(a)} />)}</div> : <Empty title={`No ${kind} files yet`}>Upload one above.</Empty>}
    </Modal>
  );
}

export function MediaLibrary() {
  const [kind, setKind] = useState("all");
  const [folder, setFolder] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "name" | "size">("new");
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<any | null>(null);
  const s = useDebounced(search);
  const list = useQuery<any>(`/api/media${qs({ kind: kind === "all" ? undefined : kind, folderId: folder || undefined, search: s, sort, limit: 48, offset })}`);
  const usage = useQuery<any>("/api/media/usage");
  const folders = useQuery<any[]>("/api/media-folders");
  const history = useQuery<any[]>("/api/media/history");
  const up = useUploader(() => { list.reload(); usage.reload(); history.reload(); });
  const confirm = useConfirm();
  useEffect(() => setOffset(0), [kind, folder, s, sort]);
  const pct = usage.data ? usage.data.usedBytes / usage.data.quotaBytes : 0;
  const newFolder = async () => {
    const name = prompt("Folder name");
    if (!name) return;
    try { await post("/api/media-folders", { name }); folders.reload(); } catch (e) { toast((e as Error).message, "bad"); }
  };
  return (
    <div className="stack-24">
      <div className="page-head"><div><h1>Media library</h1><p>Everything you upload lives here and can be reused across your profile.</p></div></div>
      <div className="grid-3">
        <div className="panel stat" style={{ gridColumn: "span 2" }}>
          <div className="k">Storage</div>
          <div className="v">{usage.data ? `${fmtBytes(usage.data.usedBytes)} of ${fmtBytes(usage.data.quotaBytes)}` : "—"}</div>
          <div className="progress" style={{ marginTop: 10 }}><i style={{ width: `${Math.min(100, pct * 100)}%`, background: pct > .9 ? "var(--bad)" : undefined }} /></div>
          <div className="row wrap small dim" style={{ marginTop: 8 }}>{usage.data?.byKind.map((k: any) => <span key={k.kind}>{k.kind}: {k.count} · {fmtBytes(Number(k.bytes))}</span>)}</div>
        </div>
        <div className="panel pad"><Dropzone onFiles={(f) => up.upload(f, { folderId: folder && folder !== "none" ? folder : null })} /><div style={{ marginTop: 10 }}><UploadList jobs={up.jobs} /></div></div>
      </div>
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <Seg label="File type" value={kind} onChange={setKind} options={["all", "image", "video", "audio", "font", "cursor"]} />
          <div className="row wrap">
            <div className="input-affix" style={{ width: 220 }}><span><LuSearch /></span><input className="input" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search files" /></div>
            <Select label="Folder" value={folder} onChange={setFolder} options={[{ value: "", label: "All folders" }, { value: "none", label: "Not in a folder" }, ...(folders.data ?? []).map((f) => ({ value: f.id, label: `${f.name} (${f.files})` }))]} />
            <Select label="Sort" value={sort} onChange={setSort} options={[{ value: "new", label: "Newest" }, { value: "old", label: "Oldest" }, { value: "name", label: "Name" }, { value: "size", label: "Largest" }]} />
            <Button size="sm" onClick={newFolder}><LuPlus />Folder</Button>
          </div>
        </div>
        <div className="panel-body">
          {list.error ? <ErrorBlock error={list.error} retry={list.reload} /> : !list.data ? <div className="skel" style={{ height: 200 }} /> :
            list.data.items.length ? <div className="media-grid">{list.data.items.map((a: any) => <Tile key={a.id} a={a} selected={sel?.id === a.id} onClick={() => setSel(a)} />)}</div> :
            <Empty icon={<LuFolder />} title="No files here">Upload images, videos, music, fonts and cursors to use them on your profile.</Empty>}
        </div>
        {list.data && <Pager total={list.data.total} limit={48} offset={offset} onChange={setOffset} />}
      </div>
      {folders.data && folders.data.length > 0 && (
        <div className="panel"><div className="panel-head"><h3>Folders</h3></div><div className="panel-body col">
          {folders.data.map((f) => <div key={f.id} className="list-item"><LuFolder /><b className="grow">{f.name}</b><span className="small dim">{f.files} files</span>
            <Button size="sm" kind="ghost" onClick={async () => { const n = prompt("Rename folder", f.name); if (n) { try { await patch(`/api/media-folders/${f.id}`, { name: n }); folders.reload(); } catch (e) { toast((e as Error).message, "bad"); } } }}><LuPencil />Rename</Button>
            <Button size="sm" kind="ghost" onClick={async () => { if (await confirm({ title: `Delete folder "${f.name}"?`, body: "Files inside are kept and moved back to All files.", confirm: "Delete folder", danger: true })) { await del(`/api/media-folders/${f.id}`); folders.reload(); list.reload(); } }}><LuTrash2 /></Button></div>)}
        </div></div>
      )}
      <div className="panel"><div className="panel-head"><h3>Upload history</h3></div><div className="table-wrap"><table className="t"><thead><tr><th>File</th><th>Type</th><th>Size</th><th>Started</th><th>Status</th></tr></thead><tbody>
        {(history.data ?? []).slice(0, 20).map((h) => <tr key={h.id}><td>{h.filename}</td><td>{h.kind}</td><td>{fmtBytes(Number(h.declared_size))}</td><td>{fmtDate(h.created_at, true)}</td><td>{h.completed_at ? <span className="chip ok">Uploaded</span> : h.failed ? <span className="chip bad">Failed or abandoned</span> : <span className="chip dim">In progress</span>}</td></tr>)}
        {history.data?.length === 0 && <tr><td colSpan={5} className="muted">No uploads yet</td></tr>}
      </tbody></table></div></div>
      {sel && <AssetDetail a={sel} folders={folders.data ?? []} onClose={() => setSel(null)} onChanged={() => { list.reload(); usage.reload(); refreshMedia(); }} />}
    </div>
  );
}

function AssetDetail({ a, folders, onClose, onChanged }: { a: any; folders: any[]; onClose: () => void; onChanged: () => void }) {
  const q = useQuery<any>(`/api/media/${a.id}`);
  const [name, setName] = useState(a.name);
  const confirm = useConfirm();
  const up = useUploader(() => { onChanged(); q.reload(); toast("File replaced everywhere it's used", "ok"); });
  const replaceInput = useRef<HTMLInputElement>(null);
  const d = q.data ?? a;
  const save = async (p: any) => { try { await patch(`/api/media/${a.id}`, p); onChanged(); toast("Saved", "ok"); } catch (e) { toast((e as Error).message, "bad"); } };
  const remove = async () => {
    const uses: string[] = q.data?.usages ?? [];
    const ok = await confirm({ title: `Delete ${a.name}?`, body: uses.length ? `It's used in: ${uses.join(", ")}. Deleting removes it from your draft; your published page stops showing it.` : "This can't be undone.", confirm: "Delete file", danger: true });
    if (!ok) return;
    try { await del(`/api/media/${a.id}`, { force: true }); onChanged(); onClose(); toast("File deleted", "ok"); } catch (e) { toast((e as Error).message, "bad"); }
  };
  return (
    <Modal title="File details" onClose={onClose} wide footer={<><Button kind="danger" onClick={remove}><LuTrash2 />Delete</Button><Button onClick={() => replaceInput.current?.click()}><LuRefreshCw />Replace</Button></>}>
      <div className="grid-2">
        <div className="inset" style={{ display: "grid", placeItems: "center", minHeight: 220, overflow: "hidden" }}>
          {d.kind === "video" ? <video src={d.url} poster={d.thumbUrl ?? undefined} controls style={{ maxWidth: "100%", maxHeight: 320 }} /> :
            d.kind === "audio" ? <audio src={d.url} controls /> : d.kind === "font" ? <div style={{ padding: 20 }} className="muted">Font file</div> :
            <img src={d.url} alt={d.name} style={{ maxWidth: "100%", maxHeight: 320 }} />}
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label htmlFor="an">Name</label><div className="row"><input id="an" className="input" value={name} onChange={(e) => setName(e.target.value)} /><Button size="sm" onClick={() => save({ name })}>Rename</Button></div></div>
          <div className="field"><label>Folder</label><Select value={d.folderId ?? ""} onChange={(v) => save({ folderId: v || null })} options={[{ value: "", label: "No folder" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]} /></div>
          <dl className="kv small">
            <dt>Type</dt><dd>{d.mime}</dd><dt>Size</dt><dd>{fmtBytes(d.size)}</dd>
            {d.width && <><dt>Dimensions</dt><dd>{d.width}×{d.height}</dd></>}
            {d.durationMs != null && <><dt>Duration</dt><dd>{(d.durationMs / 1000).toFixed(1)} s</dd></>}
            {d.metadata?.title && <><dt>Title tag</dt><dd>{d.metadata.title}{d.metadata.artist ? ` — ${d.metadata.artist}` : ""}</dd></>}
            <dt>Uploaded</dt><dd>{fmtDate(d.createdAt, true)}</dd>
            <dt>Used in</dt><dd>{q.data ? (q.data.usages.length ? q.data.usages.join(", ") : "Not used") : "…"}</dd>
          </dl>
          <UploadList jobs={up.jobs} />
        </div>
      </div>
      <input ref={replaceInput} type="file" hidden accept={ACCEPT[d.kind]} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) up.upload([f], { replaceAssetId: a.id }); }} />
    </Modal>
  );
}
