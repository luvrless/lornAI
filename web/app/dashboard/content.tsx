/** @jsxRuntime automatic @jsxImportSource react */
/** Draft-content editors: profile, links, pages, widgets, music. All share the editor store + live preview. */
import { useRef, useState } from "react";
import { LuGripVertical, LuTrash2, LuPlus, LuArrowUp, LuArrowDown, LuEye, LuEyeOff, LuArchive, LuStar, LuChevronDown, LuChevronRight, LuUser, LuImage, LuSearch, LuShield, LuMusic } from "react-icons/lu";
import { PLATFORMS, PAGE_LAYOUTS, PLAYER_LAYOUTS, HOVER_EFFECTS, newId, isSafeUrl, hostMatches, type PlatformKey } from "../../../shared/profile-schema.ts";
import { WIDGETS, widgetDefaults, type WidgetType } from "../../../shared/widgets.ts";
import { edit, useEditor, setPath } from "../editor-store.ts";
import { EditorLayout, Section, NumCtl, ColorCtl, SelectCtl, SegCtl, BoolCtl, TextCtl, AssetCtl, useMedia, useVal } from "./editor-kit.tsx";
import { ZodField } from "./zodform.tsx";
import { MediaPicker } from "./media.tsx";
import { PLATFORM_ICONS } from "../../profile/icons.tsx";
import { Button, Select, Toggle, Empty, Modal, Seg, humanize, useReorder, ColorField } from "../ui.tsx";

// ------------------------------------------------------------------ profile

function AvatarEditor() {
  const av = useEditor((s) => s.config.avatar);
  const media = useMedia();
  const a = av.assetId ? media[av.assetId] : null;
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  if (!a) return null;
  return (
    <div className="ctl">
      <div className="ctl-head"><label>Position and crop</label><span className="small dim">Drag to reposition</span></div>
      <div className="row" style={{ alignItems: "center", gap: 18 }}>
        <div
          style={{ width: 132, height: 132, borderRadius: av.shape === "circle" ? "50%" : av.shape === "rounded" ? "24%" : 6, overflow: "hidden", border: "1px solid var(--hair-strong)", cursor: "grab", touchAction: "none", flex: "none" }}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: av.offsetX, oy: av.offsetY }; }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const k = 100 / 132 / av.zoom;
            setPath("avatar.offsetX", Math.max(-50, Math.min(50, Math.round(d.ox + (e.clientX - d.x) * k))));
            setPath("avatar.offsetY", Math.max(-50, Math.min(50, Math.round(d.oy + (e.clientY - d.y) * k))));
          }}
          onPointerUp={() => (drag.current = null)}
          role="img" aria-label="Avatar crop preview">
          <img src={a.url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${av.offsetX}%, ${av.offsetY}%) scale(${av.zoom})`, pointerEvents: "none" }} />
        </div>
        <div className="grow col">
          <NumCtl path="avatar.zoom" label="Zoom" min={1} max={4} step={0.05} />
          <NumCtl path="avatar.offsetX" label="Horizontal" min={-50} max={50} />
          <NumCtl path="avatar.offsetY" label="Vertical" min={-50} max={50} />
        </div>
      </div>
    </div>
  );
}

export function ProfileSettings() {
  const [open, setOpen] = useState("identity");
  const t = (id: string) => setOpen((o) => (o === id ? "" : id));
  const langs = useVal<string[]>("identity.languages");
  const [lang, setLang] = useState("");
  const banner = useVal<string | null>("banner.assetId");
  return (
    <EditorLayout entry="skip">
      <Section id="identity" open={open === "identity"} onToggle={t} icon={<LuUser />} title="About you">
        <TextCtl path="identity.displayName" label="Display name" max={32} placeholder="Shown instead of your username" />
        <TextCtl path="identity.bio" label="Bio" max={500} area />
        <TextCtl path="identity.status" label="Status" max={80} placeholder="What are you up to?" />
        <TextCtl path="identity.location" label="Location" max={60} />
        <TextCtl path="identity.website" label="Website" max={2048} placeholder="https://" />
        <div className="ctl">
          <div className="ctl-head"><label>Languages</label></div>
          <div className="chips">{langs.map((l, i) => <span key={i} className="chip">{l}<button className="btn ghost sm icon" style={{ height: 18, width: 18 }} onClick={() => setPath("identity.languages", langs.filter((_, j) => j !== i))} aria-label={`Remove ${l}`}>×</button></span>)}</div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (lang.trim() && langs.length < 10) { setPath("identity.languages", [...langs, lang.trim().slice(0, 24)]); setLang(""); } }}>
            <input className="input" value={lang} onChange={(e) => setLang(e.target.value)} placeholder="Add a language" maxLength={24} aria-label="Language" /><Button size="sm" type="submit">Add</Button>
          </form>
        </div>
        <BoolCtl path="identity.showJoined" label="Show join date" />
        <BoolCtl path="identity.showViews" label="Show view counter" />
        <BoolCtl path="identity.showUid" label="Show UID" />
      </Section>
      <Section id="avatar" open={open === "avatar"} onToggle={t} icon={<LuUser />} title="Avatar">
        <AssetCtl path="avatar.assetId" label="Avatar image" kinds={["image"]} hint="Square images work best; GIFs stay animated" />
        <AvatarEditor />
        <SegCtl path="avatar.shape" label="Shape" options={["circle", "rounded", "square"]} />
        <NumCtl path="avatar.size" label="Size" min={48} max={220} unit="px" />
        <NumCtl path="avatar.borderWidth" label="Border" min={0} max={12} unit="px" />
        <ColorCtl path="avatar.borderColor" label="Border colour" alpha />
        <NumCtl path="avatar.glow" label="Glow" min={0} max={100} />
      </Section>
      <Section id="banner" open={open === "banner"} onToggle={t} icon={<LuImage />} title="Banner">
        <AssetCtl path="banner.assetId" label="Banner image" kinds={["image"]} hint="Shown on the Classic and Wide card layouts" />
        {banner && <>
          <NumCtl path="banner.height" label="Height" min={60} max={320} unit="px" />
          <NumCtl path="banner.posX" label="Horizontal position" min={0} max={100} unit="%" />
          <NumCtl path="banner.posY" label="Vertical position" min={0} max={100} unit="%" />
          <NumCtl path="banner.scale" label="Zoom" min={1} max={3} step={0.05} />
          <NumCtl path="banner.blur" label="Blur" min={0} max={40} unit="px" />
          <NumCtl path="banner.opacity" label="Opacity" min={0} max={100} unit="%" />
          <ColorCtl path="banner.overlayColor" label="Overlay" alpha />
        </>}
      </Section>
      <Section id="seo" open={open === "seo"} onToggle={t} icon={<LuSearch />} title="Sharing and search">
        <TextCtl path="seo.title" label="Browser and preview title" max={70} placeholder="Defaults to your display name" />
        <TextCtl path="seo.description" label="Preview description" max={200} area placeholder="Defaults to your bio" />
        <AssetCtl path="seo.ogImageAssetId" label="Preview image" kinds={["image"]} hint="Shown when your link is shared (1200×630 works best)" />
        <AssetCtl path="seo.faviconAssetId" label="Browser tab icon" kinds={["image"]} />
        <BoolCtl path="seo.indexable" label="Allow search engines" />
      </Section>
      <Section id="privacy" open={open === "privacy"} onToggle={t} icon={<LuShield />} title="Visibility">
        <SegCtl path="visibility" label="Who can see your profile" options={["public", "unlisted", "private"]} />
        <p className="small dim">Unlisted profiles open by link but are hidden from search engines. Private profiles show “This profile is private”. Publish to apply.</p>
      </Section>
    </EditorLayout>
  );
}

// ------------------------------------------------------------------ links

const PLATFORM_KEYS = Object.keys(PLATFORMS) as PlatformKey[];

function LinkRow({ l, i, bind, move, count }: { l: any; i: number; bind: any; move: (i: number, d: -1 | 1) => void; count: number }) {
  const [open, setOpen] = useState(!l.url);
  const Icon = PLATFORM_ICONS[l.platform];
  const upd = (p: object) => edit((c) => { Object.assign(c.links.find((x) => x.id === l.id)!, p); }, `link:${l.id}:${Object.keys(p).join()}`);
  const urlErr = l.url && !isSafeUrl(l.url) ? "Use a full https:// link" : l.url && !hostMatches(l.url, l.platform) ? `This doesn't look like a ${PLATFORMS[l.platform as PlatformKey].label} link` : null;
  const now = new Date();
  const sched = l.startAt && new Date(l.startAt) > now ? "Scheduled" : l.endAt && new Date(l.endAt) <= now ? "Expired" : null;
  const [iconPick, setIconPick] = useState(false);
  const media = useMedia();
  const local = (d: string | null) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  return (
    <div {...bind(i)} style={{ flexDirection: "column", alignItems: "stretch", opacity: l.visible && !l.archived ? 1 : .6 }}>
      <div className="row">
        <span className="handle" aria-hidden><LuGripVertical /></span>
        <Icon style={{ width: 20, height: 20, flex: "none" }} />
        <div className="grow" style={{ minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>{l.title || PLATFORMS[l.platform as PlatformKey].label}</b>
          <div className="small dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url || "No link yet"}</div>
        </div>
        {l.featured && <span className="chip">Featured</span>}{sched && <span className="chip warn">{sched}</span>}{l.archived && <span className="chip dim">Archived</span>}
        <Button size="sm" kind="ghost" icon onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><LuArrowUp /></Button>
        <Button size="sm" kind="ghost" icon onClick={() => move(i, 1)} disabled={i === count - 1} aria-label="Move down"><LuArrowDown /></Button>
        <Button size="sm" kind="ghost" icon onClick={() => upd({ visible: !l.visible })} aria-label={l.visible ? "Hide link" : "Show link"}>{l.visible ? <LuEye /> : <LuEyeOff />}</Button>
        <Button size="sm" kind="ghost" icon onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Edit link">{open ? <LuChevronDown /> : <LuChevronRight />}</Button>
      </div>
      {open && (
        <div className="col" style={{ paddingTop: 12, gap: 12 }}>
          <div className="grid-2">
            <div className="field"><label>Platform</label><Select value={l.platform} onChange={(v) => upd({ platform: v })} options={PLATFORM_KEYS.map((k) => ({ value: k, label: PLATFORMS[k].label }))} /></div>
            <div className="field"><label>Title</label><input className="input" value={l.title} maxLength={60} onChange={(e) => upd({ title: e.target.value })} placeholder={PLATFORMS[l.platform as PlatformKey].label} /></div>
          </div>
          <div className="field"><label>Link</label><input className="input" value={l.url} onChange={(e) => upd({ url: e.target.value.trim() })} placeholder={l.platform === "email" ? "mailto:you@example.com" : "https://"} aria-invalid={!!urlErr} />{urlErr && <span className="err">{urlErr}</span>}</div>
          <div className="field"><label>Description</label><input className="input" value={l.description} maxLength={140} onChange={(e) => upd({ description: e.target.value })} placeholder="Shown on button layouts" /></div>
          <div className="grid-2">
            <div className="field"><label>Show from</label><input className="input" type="datetime-local" value={local(l.startAt)} onChange={(e) => upd({ startAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
            <div className="field"><label>Hide after</label><input className="input" type="datetime-local" value={local(l.endAt)} onChange={(e) => upd({ endAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Hover effect</label><Select value={l.hover} onChange={(v) => upd({ hover: v })} options={HOVER_EFFECTS} /></div>
            <div className="field"><label>Colour</label>{l.color ? <div className="row"><ColorField value={l.color} onChange={(v) => upd({ color: v })} label="Link colour" /><Button size="sm" kind="ghost" onClick={() => upd({ color: null })}>Default</Button></div> : <Button size="sm" onClick={() => upd({ color: "#60a5fa" })}>Set custom colour</Button>}</div>
          </div>
          <div className="row wrap">
            <Button size="sm" onClick={() => setIconPick(true)}>{l.iconAssetId && media[l.iconAssetId] ? "Change custom icon" : "Use custom icon"}</Button>
            {l.iconAssetId && <Button size="sm" kind="ghost" onClick={() => upd({ iconAssetId: null })}>Use platform icon</Button>}
            <label className="row small"><Toggle checked={l.iconOnly} onChange={(v) => upd({ iconOnly: v })} label="Icon only" />Icon only</label>
            <label className="row small"><Toggle checked={l.featured} onChange={(v) => upd({ featured: v })} label="Featured" /><LuStar />Featured</label>
            <div className="grow" />
            <Button size="sm" kind="ghost" onClick={() => upd({ archived: !l.archived })}><LuArchive />{l.archived ? "Restore" : "Archive"}</Button>
            <Button size="sm" kind="danger" onClick={() => edit((c) => { c.links = c.links.filter((x) => x.id !== l.id); })}><LuTrash2 />Delete</Button>
          </div>
          {iconPick && <MediaPicker kinds={["icon", "image"]} onClose={() => setIconPick(false)} onPick={(x) => { upd({ iconAssetId: x.id }); setIconPick(false); }} />}
        </div>
      )}
    </div>
  );
}

export function Links() {
  const links = useEditor((s) => s.config.links);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const list = links.filter((l) => showArchived || !l.archived);
  const { bind, move } = useReorder(list, (next) => edit((c) => { const archived = showArchived ? [] : c.links.filter((l) => l.archived); c.links = [...next, ...archived]; }, ""));
  return (
    <EditorLayout entry="skip">
      <div className="acc-body" style={{ padding: 18 }}>
        <div className="spread"><h3>Social links</h3><Button size="sm" kind="primary" onClick={() => setAdding(true)} disabled={links.length >= 60}><LuPlus />Add link</Button></div>
        <p className="small dim">Drag to reorder. Links are validated on save; dangerous links (javascript:, data:) are refused.</p>
        {links.some((l) => l.archived) && <label className="row small"><Toggle checked={showArchived} onChange={setShowArchived} label="Show archived" />Show archived links</label>}
        {list.length ? <div className="col">{list.map((l, i) => <LinkRow key={l.id} l={l} i={i} bind={bind} move={move} count={list.length} />)}</div>
          : <Empty title="No links yet" action={<Button kind="primary" onClick={() => setAdding(true)}>Add your first link</Button>}>Connect your Discord, GitHub, socials or any website.</Empty>}
      </div>
      {adding && (
        <Modal title="Add a link" onClose={() => setAdding(false)} wide>
          <div className="grid-4">{PLATFORM_KEYS.map((k) => { const I = PLATFORM_ICONS[k]; return (
            <button key={k} className="btn" style={{ height: 56, justifyContent: "flex-start" }} onClick={() => { edit((c) => { c.links.push({ id: newId(), platform: k, url: k === "email" ? "mailto:" : "", title: "", description: "", iconAssetId: null, iconOnly: false, featured: false, visible: true, archived: false, color: null, hover: "lift", startAt: null, endAt: null }); }); setAdding(false); }}>
              <I style={{ width: 20, height: 20 }} />{PLATFORMS[k].label}</button>); })}</div>
        </Modal>
      )}
    </EditorLayout>
  );
}

// ------------------------------------------------------------------ widgets

const CATS = ["personal", "gaming", "media", "social", "utility"] as const;

export function WidgetList({ list, onChange }: { list: any[]; onChange: (fn: (w: any[]) => void, key?: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cat, setCat] = useState<typeof CATS[number]>("personal");
  const { bind, move } = useReorder(list, (next) => onChange((w) => { w.splice(0, w.length, ...next); }));
  return (
    <div className="col">
      {list.map((w, i) => {
        const def = (WIDGETS as any)[w.type];
        return (
          <div key={w.id} {...bind(i)} style={{ flexDirection: "column", alignItems: "stretch", opacity: w.visible ? 1 : .6 }}>
            <div className="row">
              <span className="handle" aria-hidden><LuGripVertical /></span>
              <b className="grow" style={{ fontSize: 13.5 }}>{def?.label ?? w.type}</b>
              <span className="chip dim">{def?.category}</span>
              <Button size="sm" kind="ghost" icon onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><LuArrowUp /></Button>
              <Button size="sm" kind="ghost" icon onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down"><LuArrowDown /></Button>
              <Button size="sm" kind="ghost" icon onClick={() => onChange((ws) => { ws[i].visible = !ws[i].visible; })} aria-label={w.visible ? "Hide widget" : "Show widget"}>{w.visible ? <LuEye /> : <LuEyeOff />}</Button>
              <Button size="sm" kind="ghost" icon onClick={() => setOpenId(openId === w.id ? null : w.id)} aria-expanded={openId === w.id} aria-label="Configure widget">{openId === w.id ? <LuChevronDown /> : <LuChevronRight />}</Button>
            </div>
            {openId === w.id && def && (
              <div className="col" style={{ paddingTop: 12 }}>
                <ZodField schema={def.schema} name="settings" value={w.config} onChange={(v) => onChange((ws) => { ws[i].config = v; }, `widget:${w.id}`)} />
                <div className="spread">
                  <label className="row small">Width <Seg label="Width" value={String(w.span) as any} onChange={(v) => onChange((ws) => { ws[i].span = Number(v); })} options={["1", "2", "3"]} /></label>
                  <div className="row">
                    <Button size="sm" kind="ghost" onClick={() => onChange((ws) => { ws[i].config = widgetDefaults(w.type as WidgetType); })}>Restore defaults</Button>
                    <Button size="sm" kind="danger" onClick={() => onChange((ws) => { ws.splice(i, 1); })}><LuTrash2 />Delete</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <Button onClick={() => setAdding(true)} disabled={list.length >= 40}><LuPlus />Add widget</Button>
      {adding && (
        <Modal title="Add a widget" onClose={() => setAdding(false)} wide>
          <Seg label="Category" value={cat} onChange={setCat} options={CATS} />
          <div className="grid-3">{Object.entries(WIDGETS).filter(([, d]) => d.category === cat).map(([type, d]) => (
            <button key={type} className="btn" style={{ height: 52, justifyContent: "flex-start" }} onClick={() => {
              const id = newId();
              onChange((ws) => { ws.push({ id, type, visible: true, span: 1, config: widgetDefaults(type as WidgetType) }); });
              setOpenId(id); setAdding(false);
            }}>{d.label}</button>))}</div>
          {cat === "social" && <p className="small dim">Social widgets load live data from each platform. Steam, Twitch and YouTube need API keys on the server; the widget says so if they're missing.</p>}
        </Modal>
      )}
    </div>
  );
}

export function Widgets() {
  const widgets = useEditor((s) => s.config.widgets);
  return (
    <EditorLayout entry="skip">
      <div className="acc-body" style={{ padding: 18 }}>
        <h3>Widgets on your main page</h3>
        <p className="small dim">Widgets appear inside your profile card. Add more on extra pages in Pages.</p>
        <WidgetList list={widgets} onChange={(fn, key) => edit((c) => fn(c.widgets), key)} />
      </div>
    </EditorLayout>
  );
}

// ------------------------------------------------------------------ pages

export function Pages() {
  const pages = useEditor((s) => s.config.pages);
  const [sel, setSel] = useState(0);
  const p = pages[sel];
  const upd = (fn: (pg: any) => void, key = "") => edit((c) => fn(c.pages[sel]), key);
  return (
    <EditorLayout entry="skip">
      <div className="acc-body" style={{ padding: 18 }}>
        <div className="spread"><h3>Pages</h3><Button size="sm" kind="primary" disabled={pages.length >= 10} onClick={() => { const n = pages.length + 1; edit((c) => { c.pages.push({ id: newId(), slug: `page-${n}`, title: `Page ${n}`, description: "", layout: "stack", visible: true, backgroundAssetId: null, backgroundColor: null, animation: { type: "fadeUp", durationMs: 600, delayMs: 0, stagger: 60, intensity: 50 }, widgets: [] }); }); setSel(pages.length); }}><LuPlus />Add page</Button></div>
        <p className="small dim">Each page has its own address (lorn.lol/you/page), layout and widgets. Free accounts get two extra pages.</p>
        {pages.length === 0 ? <Empty title="No extra pages">Use pages for a gaming setup, a gallery, projects or anything else.</Empty> : <>
          <Seg label="Page" value={String(sel) as any} onChange={(v) => setSel(Number(v))} options={pages.map((pg, i) => ({ value: String(i) as any, label: pg.title || "Untitled" }))} />
          {p && <div className="col" style={{ gap: 14 }}>
            <div className="grid-2">
              <div className="field"><label>Heading</label><input className="input" value={p.title} maxLength={60} onChange={(e) => upd((pg) => { pg.title = e.target.value; }, `p:${p.id}:t`)} /></div>
              <div className="field"><label>Address</label><div className="input-affix"><span>/</span><input className="input" value={p.slug} maxLength={32} onChange={(e) => upd((pg) => { pg.slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"); }, `p:${p.id}:s`)} /></div></div>
            </div>
            <div className="field"><label>Description</label><textarea className="textarea" value={p.description} maxLength={300} onChange={(e) => upd((pg) => { pg.description = e.target.value; }, `p:${p.id}:d`)} /></div>
            <div className="field"><label>Layout</label><Select value={p.layout} onChange={(v) => upd((pg) => { pg.layout = v; })} options={PAGE_LAYOUTS} /></div>
            <div className="grid-2">
              <div className="field"><label>Background colour</label>{p.backgroundColor ? <div className="row"><ColorField value={p.backgroundColor} onChange={(v) => upd((pg) => { pg.backgroundColor = v; }, `p:${p.id}:bg`)} label="Page background" /><Button size="sm" kind="ghost" onClick={() => upd((pg) => { pg.backgroundColor = null; })}>None</Button></div> : <Button size="sm" onClick={() => upd((pg) => { pg.backgroundColor = "#0b1226cc"; })}>Set colour</Button>}</div>
              <div className="field"><label>Entrance</label><Select value={p.animation.type} onChange={(v) => upd((pg) => { pg.animation.type = v; })} options={["none", "fade", "fadeUp", "fadeDown", "zoom", "blur", "slideLeft", "slideRight", "flip", "bounce"]} /></div>
            </div>
            <label className="row small"><Toggle checked={p.visible} onChange={(v) => upd((pg) => { pg.visible = v; })} label="Visible" />Visible on your profile</label>
            <h4>Widgets on this page</h4>
            <WidgetList list={p.widgets} onChange={(fn, key) => edit((c) => fn(c.pages[sel].widgets), key)} />
            <div className="row">
              <Button size="sm" kind="ghost" disabled={sel === 0} onClick={() => { edit((c) => { [c.pages[sel - 1], c.pages[sel]] = [c.pages[sel], c.pages[sel - 1]]; }); setSel(sel - 1); }}><LuArrowUp />Move earlier</Button>
              <Button size="sm" kind="ghost" disabled={sel === pages.length - 1} onClick={() => { edit((c) => { [c.pages[sel + 1], c.pages[sel]] = [c.pages[sel], c.pages[sel + 1]]; }); setSel(sel + 1); }}><LuArrowDown />Move later</Button>
              <div className="grow" />
              <Button size="sm" kind="danger" onClick={() => { edit((c) => { c.pages.splice(sel, 1); }); setSel(Math.max(0, sel - 1)); }}><LuTrash2 />Delete page</Button>
            </div>
          </div>}
        </>}
      </div>
    </EditorLayout>
  );
}

// ------------------------------------------------------------------ music

function LyricsEditor({ track, onSave, onClose }: { track: any; onSave: (l: any[]) => void; onClose: () => void }) {
  const media = useMedia();
  const audio = useRef<HTMLAudioElement>(null);
  const [lines, setLines] = useState<{ t: number; text: string }[]>(track.lyrics);
  const [bulk, setBulk] = useState("");
  const a = media[track.assetId];
  return (
    <Modal title={`Lyrics — ${track.title}`} onClose={onClose} wide footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="primary" onClick={() => { onSave([...lines].sort((x, y) => x.t - y.t)); onClose(); }}>Save lyrics</Button></>}>
      {a && <audio ref={audio} src={a.url} controls style={{ width: "100%" }} />}
      <p className="small dim">Play the song and press “Stamp” on each line as it's sung. Or paste LRC lines like [01:23.40] words.</p>
      <div className="col">
        {lines.map((l, i) => (
          <div key={i} className="row">
            <input className="input" style={{ width: 90 }} type="number" step="0.1" min={0} value={l.t} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, t: Number(e.target.value) } : x)))} aria-label="Time in seconds" />
            <Button size="sm" onClick={() => setLines(lines.map((x, j) => (j === i ? { ...x, t: Math.round((audio.current?.currentTime ?? 0) * 10) / 10 } : x)))}>Stamp</Button>
            <input className="input grow" value={l.text} maxLength={200} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-label="Lyric line" />
            <Button size="sm" kind="ghost" icon onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line"><LuTrash2 /></Button>
          </div>
        ))}
        <Button size="sm" onClick={() => setLines([...lines, { t: Math.round((audio.current?.currentTime ?? 0) * 10) / 10, text: "" }])}><LuPlus />Add line</Button>
        <textarea className="textarea" placeholder="[00:12.00] First line&#10;[00:15.50] Second line" value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <Button size="sm" disabled={!bulk.trim()} onClick={() => {
          const parsed = bulk.split("\n").map((ln) => /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(ln.trim())).filter(Boolean).map((m) => ({ t: Number(m![1]) * 60 + Number(m![2]), text: m![3].slice(0, 200) }));
          setLines(parsed.slice(0, 500)); setBulk("");
        }}>Import LRC</Button>
      </div>
    </Modal>
  );
}

export function Music() {
  const music = useEditor((s) => s.config.music);
  const media = useMedia();
  const [picking, setPicking] = useState(false);
  const [coverFor, setCoverFor] = useState<number | null>(null);
  const [lyricsFor, setLyricsFor] = useState<number | null>(null);
  const { bind, move } = useReorder(music.tracks, (next) => edit((c) => { c.music.tracks = next; }));
  const updT = (i: number, p: object, key = "") => edit((c) => { Object.assign(c.music.tracks[i], p); }, key);
  return (
    <EditorLayout entry="skip">
      <div className="acc-body" style={{ padding: 18 }}>
        <BoolCtl path="music.enabled" label="Play music on your profile" />
        <SelectCtl path="music.layout" label="Player style" options={PLAYER_LAYOUTS} />
        <SegCtl path="music.position" label="Player position" options={["card", "top", "bottom"]} />
        <BoolCtl path="music.autoplay" label="Start automatically" hint="Browsers only allow this after a click — turn on Click to enter for reliable autoplay." />
        <NumCtl path="music.volume" label="Starting volume" min={0} max={100} unit="%" />
        <BoolCtl path="music.shuffle" label="Shuffle" />
        <SegCtl path="music.loop" label="Repeat" options={["none", "one", "all"]} />
        <div className="spread"><h3>Tracks</h3><Button size="sm" kind="primary" onClick={() => setPicking(true)} disabled={music.tracks.length >= 50}><LuPlus />Add track</Button></div>
        {music.tracks.length === 0 ? <Empty icon={<LuMusic />} title="No tracks yet">Upload MP3, OGG, WAV, M4A or FLAC files.</Empty> : (
          <div className="col">{music.tracks.map((t, i) => {
            const cover = t.coverAssetId ? media[t.coverAssetId] : null;
            return (
              <div key={t.id} {...bind(i)} style={{ alignItems: "flex-start" }}>
                <span className="handle" aria-hidden style={{ marginTop: 10 }}><LuGripVertical /></span>
                <button className="thumb" style={{ border: 0, cursor: "pointer", padding: 0 }} onClick={() => setCoverFor(i)} aria-label="Choose cover art">{cover?.thumbUrl ? <img src={cover.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <LuImage color="var(--dim)" />}</button>
                <div className="grow col" style={{ gap: 6 }}>
                  <input className="input" value={t.title} maxLength={100} onChange={(e) => updT(i, { title: e.target.value }, `t:${t.id}:title`)} aria-label="Song name" placeholder="Song name" />
                  <input className="input" value={t.artist} maxLength={100} onChange={(e) => updT(i, { artist: e.target.value }, `t:${t.id}:artist`)} aria-label="Artist" placeholder="Artist" />
                  <div className="row small dim">{media[t.assetId]?.name ?? "File missing"}{media[t.assetId]?.durationMs ? ` · ${Math.round(media[t.assetId].durationMs! / 1000)}s` : ""} · {t.lyrics.length} lyric lines</div>
                </div>
                <div className="col" style={{ gap: 4 }}>
                  <Button size="sm" onClick={() => setLyricsFor(i)}>Lyrics</Button>
                  <div className="row" style={{ gap: 2 }}>
                    <Button size="sm" kind="ghost" icon onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><LuArrowUp /></Button>
                    <Button size="sm" kind="ghost" icon onClick={() => move(i, 1)} disabled={i === music.tracks.length - 1} aria-label="Move down"><LuArrowDown /></Button>
                    <Button size="sm" kind="ghost" icon onClick={() => edit((c) => { c.music.tracks.splice(i, 1); })} aria-label="Remove track"><LuTrash2 /></Button>
                  </div>
                </div>
              </div>
            );
          })}</div>
        )}
        <h3>Embeds</h3>
        <p className="small dim">Official Spotify, YouTube, Apple Music, SoundCloud and Twitch players. They play under each service's own rules.</p>
        {music.embeds.map((e, i) => (
          <div key={i} className="row">
            <Select value={e.provider} onChange={(v) => edit((c) => { c.music.embeds[i].provider = v; })} options={["spotify", "youtube", "applemusic", "soundcloud", "twitch"]} />
            <input className="input grow" value={e.url} onChange={(ev) => edit((c) => { c.music.embeds[i].url = ev.target.value.trim(); }, `emb:${i}`)} placeholder="https://open.spotify.com/track/…" aria-label="Embed link" />
            <Button size="sm" kind="ghost" icon onClick={() => edit((c) => { c.music.embeds.splice(i, 1); })} aria-label="Remove embed"><LuTrash2 /></Button>
          </div>
        ))}
        {music.embeds.length < 5 && <Button size="sm" onClick={() => edit((c) => { c.music.embeds.push({ provider: "spotify", url: "https://open.spotify.com/" }); })}><LuPlus />Add embed</Button>}
      </div>
      {picking && <MediaPicker kinds={["audio"]} onClose={() => setPicking(false)} onPick={(a) => {
        edit((c) => { c.music.enabled = true; c.music.tracks.push({ id: newId(), assetId: a.id, title: a.metadata?.title || a.name.replace(/\.\w+$/, ""), artist: a.metadata?.artist ?? "", coverAssetId: null, lyrics: [] }); });
        setPicking(false);
      }} />}
      {coverFor != null && <MediaPicker kinds={["image"]} onClose={() => setCoverFor(null)} onPick={(a) => { updT(coverFor, { coverAssetId: a.id }); setCoverFor(null); }} />}
      {lyricsFor != null && <LyricsEditor track={music.tracks[lyricsFor]} onClose={() => setLyricsFor(null)} onSave={(l) => updT(lyricsFor, { lyrics: l })} />}
    </EditorLayout>
  );
}

export { humanize, setPath };
