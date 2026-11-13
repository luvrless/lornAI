/** @jsxRuntime automatic @jsxImportSource react */
/**
 * The profile renderer. One component renders the public page (server +
 * hydration) and the editor preview, so the preview is the published result.
 * Everything is driven by the validated config; nothing is hardcoded per user.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LuArrowRight, LuPlay, LuSparkles, LuDoorOpen, LuPower, LuMapPin, LuCalendar, LuEye, LuLink } from "react-icons/lu";
import type { ProfileConfig } from "../../shared/profile-schema.ts";
import { linkIsLive, PLATFORMS } from "../../shared/profile-schema.ts";
import { startBackground, startOverlay, startCursorTrail, fallbackGradient, reducedMotion } from "./effects.ts";
import { EffectText } from "./text.tsx";
import { MusicPlayer, MusicEngine, type Track } from "./player.tsx";
import { WIDGET_COMPONENTS, Embed, type WidgetCtx } from "./widgets.tsx";
import { PLATFORM_ICONS, BRAND_COLORS, BADGE_GLYPHS } from "./icons.tsx";

export interface Asset { id: string; url: string; thumbUrl: string | null; mime: string; kind: string; width?: number | null; height?: number | null }
export interface Badge { id: string; key: string; name: string; tooltip: string; description?: string; iconUrl: string | null; iconPreset: string | null; color: string; gradientFrom: string | null; gradientTo: string | null; borderColor: string | null; glow: number; hover: string }
export interface Payload {
  user: { uid: number; username: string; createdAt: string; premium: boolean; verified: boolean };
  config: ProfileConfig;
  assets: Record<string, Asset>;
  badges: Badge[];
  views: number;
  integrations: Record<string, any>;
  mode: "published" | "draft";
}

export interface ViewProps {
  payload: Payload;
  mode: "public" | "preview";
  pageSlug?: string | null;
  /** Editor: force the entry screen visible (or skip it). */
  entryPreview?: "auto" | "show" | "skip";
  replayKey?: number;
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const base = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${(a * base).toFixed(3)})`;
};
const fontStack = (f: string) => (f === "system" ? "ui-sans-serif, system-ui, -apple-system, sans-serif" : `"${f}", ui-sans-serif, system-ui, sans-serif`);
const animStyle = (a: ProfileConfig["animations"]["profile"], i = 0): CSSProperties => ({
  ["--ad" as any]: `${a.durationMs}ms`, ["--adl" as any]: `${a.delayMs + i * a.stagger}ms`, ["--ai" as any]: (a.intensity / 50).toFixed(2),
});
const animCls = (a: ProfileConfig["animations"]["profile"], on: boolean) => (on && a.type !== "none" ? `anim anim-${a.type}` : "");

function beacon(username: string, kind: string, body: object) {
  if (typeof fetch === "undefined") return;
  const utm = Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => k.startsWith("utm_")).map(([k, v]) => [k.slice(4), v.slice(0, 80)]));
  fetch(`/api/p/${encodeURIComponent(username)}/${kind}`, {
    method: "POST", keepalive: true, credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referrer: document.referrer || null, utm, ...body }),
  }).catch(() => {});
}

export function useFonts(cfg: ProfileConfig, asset: (id: string | null) => Asset | null) {
  useEffect(() => {
    const fams = new Set([cfg.typography.font, cfg.entry.font].filter((f) => f !== "system"));
    for (const f of fams) {
      const id = `gf-${f.replace(/\s/g, "-")}`;
      if (document.getElementById(id)) continue;
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet";
      l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800&display=swap`;
      document.head.appendChild(l);
    }
    const cf = asset(cfg.typography.customFontAssetId);
    if (cf) {
      const id = `cf-${cfg.typography.customFontAssetId}`;
      if (!document.getElementById(id)) {
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `@font-face{font-family:"lorn-custom-${cfg.typography.customFontAssetId}";src:url("${cf.url}");font-display:swap}`;
        document.head.appendChild(s);
      }
    }
  }, [cfg.typography.font, cfg.entry.font, cfg.typography.customFontAssetId]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ------------------------------------------------------------------ background

function Background({ cfg, asset, which = "profile" }: { cfg: ProfileConfig; asset: (id: string | null) => Asset | null; which?: "profile" | "entry" }) {
  const b = cfg.background;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const isEntry = which === "entry";
  const type = isEntry ? cfg.entry.bgType : b.type;
  const effect = isEntry ? cfg.entry.effect : b.effect;
  const colors = b.effectColors;

  useEffect(() => {
    if (type !== "effect" || !canvas.current) return;
    setFallback(false);
    const stop = startBackground(canvas.current, effect, { colors, speed: b.speed, intensity: b.intensity, density: b.density });
    if (!stop) setFallback(true);
    return () => stop?.();
  }, [type, effect, colors.join(), b.speed, b.intensity, b.density]); // eslint-disable-line react-hooks/exhaustive-deps

  const filter = `brightness(${b.brightness}%) contrast(${b.contrast}%) saturate(${b.saturation}%)${b.blur ? ` blur(${b.blur}px)` : ""}`;
  const media: CSSProperties = { objectPosition: `${b.posX}% ${b.posY}%`, transform: `scale(${b.scale})`, filter, opacity: b.opacity / 100 };
  const a = asset(isEntry ? cfg.entry.assetId : b.assetId);
  let layer: ReactNode = null;
  if (type === "color") layer = <div className="lp-fill" style={{ background: isEntry ? cfg.entry.color : b.color }} />;
  else if (type === "gradient") {
    const from = isEntry ? cfg.entry.gradientFrom : b.gradientFrom, to = isEntry ? cfg.entry.gradientTo : b.gradientTo;
    layer = <div className={"lp-fill" + (b.gradientAnimated && !isEntry ? " lp-grad-anim" : "")} style={{ background: `linear-gradient(${b.gradientAngle}deg, ${from}, ${!isEntry && b.gradientVia ? b.gradientVia + "," : ""} ${to})`, backgroundSize: b.gradientAnimated ? "300% 300%" : undefined }} />;
  } else if (type === "image" && a) layer = <img className="lp-media" src={a.url} alt="" style={media} />;
  else if (type === "video" && a) layer = <BgVideo src={a.url} poster={a.thumbUrl} style={media} loop={b.videoLoop} rate={b.playbackRate} />;
  else if (type === "effect") layer = <>
    <div className="lp-fill" style={{ background: fallbackGradient(colors), opacity: fallback ? 1 : 0 }} />
    <canvas ref={canvas} className="lp-media lp-canvas" style={{ filter, opacity: b.opacity / 100 }} aria-hidden />
  </>;
  else if (type === "blur") return null;
  else layer = <div className="lp-fill" style={{ background: b.color }} />;
  return <div className="lp-bg" aria-hidden>{layer}<div className="lp-fill" style={{ background: b.overlayColor, opacity: b.overlayOpacity / 100 }} /></div>;
}

function BgVideo({ src, poster, style, loop, rate }: { src: string; poster: string | null; style: CSSProperties; loop: boolean; rate: number }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (v.current) { v.current.playbackRate = rate; v.current.play().catch(() => {}); } }, [rate, src]);
  return <video ref={v} className="lp-media" src={src} poster={poster ?? undefined} style={style} autoPlay muted loop={loop} playsInline preload="auto" disablePictureInPicture />;
}

function Overlay({ cfg }: { cfg: ProfileConfig }) {
  const c = useRef<HTMLCanvasElement>(null);
  const e = cfg.effects;
  useEffect(() => {
    if (!c.current) return;
    const stop = startOverlay(c.current, e.overlay, { colors: [e.color, ...cfg.background.effectColors], speed: e.speed, intensity: 60, density: e.density, size: e.size });
    return () => stop?.();
  }, [e.overlay, e.color, e.density, e.speed, e.size, cfg.background.effectColors.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    {e.ambientLight && <div className="lp-ambient" style={{ ["--amb" as any]: rgba(cfg.card.glowColor, 0.22) }} aria-hidden />}
    {e.overlay !== "none" && e.overlay !== "ambient" && <canvas ref={c} className="lp-overlay" aria-hidden />}
  </>;
}

// ------------------------------------------------------------------ cursor

function Cursor({ cfg, asset, host }: { cfg: ProfileConfig; asset: (id: string | null) => Asset | null; host: React.RefObject<HTMLDivElement | null> }) {
  const c = cfg.cursor;
  const dot = useRef<HTMLDivElement>(null);
  const trail = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el || c.type === "default" || c.type === "none" || matchMedia("(pointer: coarse)").matches) return;
    let x = -100, y = -100, cx = -100, cy = -100, raf = 0, hover = false;
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); x = e.clientX - r.left; y = e.clientY - r.top; hover = !!(e.target as HTMLElement).closest("a,button,input,[role=button]"); };
    const tick = () => {
      cx += (x - cx) * (c.type === "ring" ? .22 : .5); cy += (y - cy) * (c.type === "ring" ? .22 : .5);
      if (dot.current) dot.current.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${hover ? c.hoverScale : 1})`;
      raf = requestAnimationFrame(tick);
    };
    el.addEventListener("pointermove", move);
    tick();
    return () => { el.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, [c.type, c.hoverScale, host]);
  useEffect(() => {
    if (c.trail === "none" || !trail.current || reducedMotion() || matchMedia("(pointer: coarse)").matches) return;
    return startCursorTrail(trail.current, c.trail, c.color, c.trailLength, c.glow);
  }, [c.trail, c.color, c.trailLength, c.glow]);
  const img = c.type === "custom" ? asset(c.assetId) : null;
  return <>
    {c.trail !== "none" && <canvas ref={trail} className="lp-trail" aria-hidden />}
    {c.type !== "default" && c.type !== "none" && (
      <div ref={dot} className={`lp-cursor lp-cursor-${c.type}`} aria-hidden
        style={{ width: c.size, height: c.size, ["--cc" as any]: c.color, boxShadow: c.glow && c.type !== "custom" ? `0 0 ${c.glow / 3}px ${c.color}` : undefined, backgroundImage: img ? `url("${img.url}")` : undefined }} />
    )}
  </>;
}

// ------------------------------------------------------------------ entry screen

const ENTRY_ICONS: Record<string, ReactNode> = { arrow: <LuArrowRight />, play: <LuPlay />, sparkles: <LuSparkles />, door: <LuDoorOpen />, power: <LuPower />, none: null };

function EntryScreen({ cfg, asset, onEnter, onGesture }: { cfg: ProfileConfig; asset: (id: string | null) => Asset | null; onEnter: () => void; onGesture: () => void }) {
  const e = cfg.entry;
  const [leaving, setLeaving] = useState<{ x: number; y: number } | null>(null);
  const sound = asset(e.soundAssetId);
  const enter = (ev: React.MouseEvent | React.KeyboardEvent) => {
    if (leaving) return;
    onGesture();
    if (sound) { const a = new Audio(sound.url); a.volume = e.volume / 100; a.play().catch(() => {}); }
    const r = (ev.currentTarget as HTMLElement).closest(".lp")!.getBoundingClientRect();
    const pt = "clientX" in ev ? { x: ev.clientX - r.left, y: ev.clientY - r.top } : { x: r.width / 2, y: r.height / 2 };
    setLeaving(pt);
    window.setTimeout(onEnter, reducedMotion() ? 0 : e.exitMs);
  };
  const bg: CSSProperties = e.bgType === "blur" ? { backdropFilter: `blur(${e.blur}px)`, WebkitBackdropFilter: `blur(${e.blur}px)`, background: rgba(e.color, .35) } : {};
  return (
    <div className={`lp-entry ${leaving ? `exit exit-${e.exit}` : ""}`} style={{ ...bg, ["--ex" as any]: `${e.exitMs}ms`, ["--rx" as any]: `${leaving?.x ?? 0}px`, ["--ry" as any]: `${leaving?.y ?? 0}px`, fontFamily: fontStack(e.font), color: e.textColor }}
      role="dialog" aria-label={e.title || "Enter profile"} onClick={enter}>
      {e.bgType !== "blur" && <Background cfg={cfg} asset={asset} which="entry" />}
      {e.bgType === "blur" || !e.blur ? null : <div className="lp-fill" style={{ backdropFilter: `blur(${e.blur}px)` }} />}
      {e.exit === "curtain" && <><div className="lp-curtain l" /><div className="lp-curtain r" /></>}
      {e.exit === "pixel" && leaving && <div className="lp-pixels">{Array.from({ length: 96 }, (_, i) => <i key={i} style={{ animationDelay: `${Math.random() * e.exitMs * .7}ms`, background: e.color }} />)}</div>}
      <div className={`lp-entry-inner ${animCls({ type: e.enterAnim, durationMs: 700, delayMs: 0, stagger: 0, intensity: 50 }, true)}`} style={animStyle({ type: e.enterAnim, durationMs: 700, delayMs: 0, stagger: 0, intensity: 50 })}>
        <EffectText as="h1" className="lp-entry-title" text={e.title} effect={e.typewriter ? "typewriter" : "none"} loop pauseMs={e.typewriterPauseMs} />
        {e.subtitle && <p className="lp-entry-sub">{e.subtitle}</p>}
        {e.description && <p className="lp-entry-desc">{e.description}</p>}
        {e.buttonText && <button className={`lp-entry-btn ${e.buttonStyle}`} onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); enter(ev); }} autoFocus>{e.buttonText}{ENTRY_ICONS[e.buttonIcon]}</button>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ badges & links

export function BadgeIcon({ b, size }: { b: Badge; size: number }) {
  const Glyph = b.iconPreset ? BADGE_GLYPHS[b.iconPreset] : null;
  const bg = b.gradientFrom && b.gradientTo ? `linear-gradient(135deg, ${b.gradientFrom}, ${b.gradientTo})` : undefined;
  return (
    <span className={`lp-badge hv-${b.hover}`} tabIndex={0} aria-label={b.tooltip} data-tip={b.tooltip}
      style={{ width: size, height: size, color: b.color, ["--bg-glow" as any]: b.glow ? `0 0 ${b.glow / 4}px ${b.color}` : "none", borderColor: b.borderColor ?? undefined }}>
      {b.iconUrl ? <img src={b.iconUrl} alt="" /> : Glyph ? <Glyph style={bg ? { color: b.gradientTo! } : undefined} /> : <LuSparkles />}
    </span>
  );
}

function Links({ cfg, asset, username, track, mode }: { cfg: ProfileConfig; asset: (id: string | null) => Asset | null; username: string; track: boolean; mode: string }) {
  const now = new Date();
  const links = cfg.links.filter((l) => (mode === "public" ? linkIsLive(l, now) : l.visible && !l.archived));
  if (!links.length) return null;
  const s = cfg.linksStyle;
  const a = cfg.animations.links;
  const featured = links.filter((l) => l.featured && !l.iconOnly);
  const rest = links.filter((l) => !featured.includes(l));
  const one = (l: typeof links[number], i: number, forceButton = false) => {
    const Icon = PLATFORM_ICONS[l.platform] ?? LuLink;
    const custom = asset(l.iconAssetId);
    const color = l.color ?? (s.useBrandColors ? BRAND_COLORS[l.platform] : s.iconColor);
    const label = l.title || PLATFORMS[l.platform].label;
    const asButton = forceButton || (s.layout !== "icons" && !l.iconOnly);
    return (
      <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={label}
        className={`lp-link ${asButton ? "btn-like" : "icon-like"} hv-${l.hover} ${animCls(a, true)}`}
        style={{ ...animStyle(a, i), ["--lc" as any]: color, ["--lb" as any]: rgba(s.buttonColor, s.buttonOpacity / 100) }}
        data-tip={asButton ? undefined : label}
        onClick={() => track && beacon(username, "click", { linkId: l.id })}>
        {custom ? <img src={custom.url} alt="" style={{ width: s.iconSize, height: s.iconSize }} /> : <Icon style={{ width: s.iconSize, height: s.iconSize, color }} />}
        {asButton && <span className="lp-link-text"><b>{label}</b>{l.description && <small>{l.description}</small>}</span>}
      </a>
    );
  };
  return <>
    {featured.length > 0 && <div className="lp-links featured">{featured.map((l, i) => one(l, i, true))}</div>}
    {rest.length > 0 && <div className={`lp-links lay-${s.layout}`}>{rest.map((l, i) => one(l, i + featured.length))}</div>}
  </>;
}

// ------------------------------------------------------------------ main view

export function ProfileView({ payload, mode, pageSlug = null, entryPreview = "auto", replayKey = 0 }: ViewProps) {
  const cfg = payload.config;
  const host = useRef<HTMLDivElement>(null);
  const asset = useCallback((id: string | null | undefined) => (id ? payload.assets[id] ?? null : null), [payload.assets]);
  const entryOn = entryPreview === "show" || (entryPreview === "auto" && cfg.entry.enabled);
  const [entered, setEntered] = useState(!entryOn);
  const [page, setPage] = useState<string | null>(pageSlug);
  const [live, setLive] = useState(payload.integrations);
  useFonts(cfg, asset);

  useEffect(() => { setEntered(!entryOn); }, [entryOn, replayKey]);
  useEffect(() => setLive(payload.integrations), [payload.integrations]);
  useEffect(() => { if (mode === "public") beacon(payload.user.username, "view", { page }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Integration widgets render from cache first, then refresh in the background.
  useEffect(() => {
    if (mode !== "public" || !Object.values(payload.integrations).some((r: any) => r?.status === "pending")) return;
    fetch(`/api/p/${encodeURIComponent(payload.user.username)}/integrations`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setLive(d)).catch(() => {});
  }, [mode, payload.user.username, payload.integrations]);

  useEffect(() => {
    if (mode !== "public") return;
    const onPop = () => setPage(location.pathname.split("/")[2] || null);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [mode]);

  const goPage = (slug: string | null) => {
    setPage(slug);
    if (mode === "public") history.pushState(null, "", `/${payload.user.username}${slug ? "/" + slug : ""}${location.search}`);
  };

  const card = cfg.card, ty = cfg.typography;
  // 3D tilt + mouse-following glow, updated through CSS variables (no re-render).
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!card.tilt3d && !card.mouseGlow) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${px * 100}%`); el.style.setProperty("--my", `${py * 100}%`);
    if (card.tilt3d && !reducedMotion()) { el.style.setProperty("--tx", `${(py - .5) * -2 * card.tiltMax}deg`); el.style.setProperty("--ty", `${(px - .5) * 2 * card.tiltMax}deg`); }
  };
  const onLeave = (e: React.PointerEvent<HTMLDivElement>) => { e.currentTarget.style.setProperty("--tx", "0deg"); e.currentTarget.style.setProperty("--ty", "0deg"); };

  const tracks: Track[] = useMemo(() => cfg.music.tracks.map((t) => {
    const a = asset(t.assetId);
    return a ? { id: t.id, title: t.title, artist: t.artist, url: a.url, cover: asset(t.coverAssetId)?.thumbUrl ?? asset(t.coverAssetId)?.url ?? null, lyrics: t.lyrics } : null;
  }).filter(Boolean) as Track[], [cfg.music.tracks, asset]);
  // One engine per track list; it survives entry-screen → profile transitions.
  const engine = useMemo(() => (cfg.music.enabled && tracks.length ? new MusicEngine(tracks, { volume: cfg.music.volume, shuffle: cfg.music.shuffle, loop: cfg.music.loop }) : null),
    [tracks.map((t) => t.id + t.url).join(), cfg.music.enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => engine?.destroy(), [engine]);
  useEffect(() => { if (engine) engine.onPlay = (t) => { if (mode === "public") beacon(payload.user.username, "play", { trackId: t.id }); }; }, [engine, mode, payload.user.username]);
  useEffect(() => { if (engine?.audio) engine.audio.volume = cfg.music.volume / 100; }, [engine, cfg.music.volume]);
  // Without an entry screen, try autoplay (browsers may refuse until the visitor interacts).
  useEffect(() => { if (engine && cfg.music.autoplay && mode === "public" && !entryOn) engine.play(); }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  const music = engine ? <MusicPlayer engine={engine} layout={cfg.music.layout} accent={ty.accentColor} /> : null;
  const embeds = cfg.music.enabled && cfg.music.embeds.length > 0 ? <div className="lp-embeds">{cfg.music.embeds.map((e, i) => <Embed key={i} provider={e.provider} url={e.url} />)}</div> : null;

  // Called synchronously from the entry click, inside the user gesture.
  const startMusic = () => { if (engine && cfg.music.autoplay) engine.play(); };
  const doEnter = () => setEntered(true);

  const vars: CSSProperties = {
    ["--font" as any]: cfg.typography.customFontAssetId && asset(cfg.typography.customFontAssetId) ? `"lorn-custom-${cfg.typography.customFontAssetId}", ${fontStack(ty.font)}` : fontStack(ty.font),
    ["--fw" as any]: ty.weight, ["--hw" as any]: ty.headingWeight, ["--fs" as any]: `${ty.size}px`, ["--ns" as any]: `${ty.nameSize}px`,
    ["--ls" as any]: `${ty.letterSpacing / 100}em`, ["--lh" as any]: ty.lineHeight, ["--ta" as any]: ty.align,
    ["--tc" as any]: ty.color, ["--tm" as any]: ty.mutedColor, ["--ac" as any]: ty.accentColor,
    ["--tsh" as any]: ty.shadow ? `0 2px ${ty.shadow / 6}px rgba(0,0,0,${ty.shadow / 120})` : "none",
    ["--tglow" as any]: ty.glow ? `0 0 ${ty.glow / 4}px ${ty.glowColor}` : "none",
    ["--cw" as any]: `${card.width}px`, ["--cmh" as any]: `${card.minHeight}px`, ["--cp" as any]: `${card.padding}px`, ["--cr" as any]: `${card.radius}px`,
    ["--cbg" as any]: rgba(card.bgColor, card.bgOpacity / 100), ["--cblur" as any]: `${card.blur}px`,
    ["--cbw" as any]: `${card.borderWidth}px`, ["--cbc" as any]: card.borderColor,
    ["--cbg1" as any]: card.borderFrom, ["--cbg2" as any]: card.borderTo,
    ["--csh" as any]: `0 ${card.shadow / 2}px ${card.shadow * 1.4}px -${card.shadow / 4}px rgba(0,0,0,${card.shadow / 110})`,
    ["--cglow" as any]: card.glow ? `0 0 ${card.glow}px -${card.glow / 4}px ${rgba(card.glowColor, card.glow / 100)}` : "0 0 0 transparent",
    ["--gc" as any]: rgba(card.glowColor, .18), ["--bs" as any]: `${cfg.badgesStyle.size}px`,
  };
  const valign = card.verticalAlign === "top" ? "flex-start" : card.verticalAlign === "bottom" ? "flex-end" : "center";
  const halign = card.align === "left" ? "flex-start" : card.align === "right" ? "flex-end" : "center";

  const av = cfg.avatar, avatarAsset = asset(av.assetId);
  const bn = cfg.banner, bannerAsset = asset(bn.assetId);
  const showBanner = !!bannerAsset && (card.layout === "classic" || card.layout === "wide");
  const name = cfg.identity.displayName || payload.user.username;
  const badges = cfg.badgesStyle.show ? payload.badges : [];
  const A = cfg.animations;
  const nameStyle: CSSProperties = ty.nameGradient ? { backgroundImage: `linear-gradient(90deg, ${ty.gradientFrom}, ${ty.gradientTo})` } : {};
  const currentPage = cfg.pages.find((p) => p.slug === page) ?? null;
  const widgetCtx = (id: string): WidgetCtx => ({ asset: asset as any, data: live[id], renderMusic: () => music });
  const renderWidgets = (list: ProfileConfig["widgets"], layout = "stack") => list.length > 0 && (
    <div className={`lp-widgets lay-${layout}`}>
      {list.filter((w) => w.visible).map((w, i) => {
        const C = WIDGET_COMPONENTS[w.type];
        if (!C) return null;
        return <section key={w.id} className={`lp-widget span-${w.span} ${animCls(A.widgets, true)}`} style={animStyle(A.widgets, i)}><C config={w.config} ctx={widgetCtx(w.id)} /></section>;
      })}
    </div>
  );

  const meta = [
    cfg.identity.location && <span key="loc"><LuMapPin />{cfg.identity.location}</span>,
    cfg.identity.showJoined && <span key="j"><LuCalendar />Joined {new Date(payload.user.createdAt).toLocaleDateString("en", { month: "short", year: "numeric" })}</span>,
    cfg.identity.showViews && <span key="v"><LuEye />{payload.views.toLocaleString("en")} views</span>,
    cfg.identity.showUid && <span key="u">UID {payload.user.uid.toLocaleString("en")}</span>,
  ].filter(Boolean);

  return (
    <div ref={host} className={`lp ${mode === "preview" ? "lp-preview" : ""} cursor-${cfg.cursor.type}`} data-align={ty.align} style={vars}>
      <Background cfg={cfg} asset={asset} />
      <Overlay cfg={cfg} />
      {entered && (
        <div className="lp-stage" style={{ alignItems: halign, justifyContent: valign }}>
          {cfg.pages.length > 0 && (
            <nav className="lp-pages" aria-label="Profile pages">
              <button aria-current={!currentPage ? "page" : undefined} onClick={() => goPage(null)}>Home</button>
              {cfg.pages.map((p) => <button key={p.id} aria-current={currentPage?.id === p.id ? "page" : undefined} onClick={() => goPage(p.slug)}>{p.title}</button>)}
            </nav>
          )}
          {cfg.music.position === "top" && music && <div className="lp-bar top">{music}</div>}
          {currentPage ? (
            <div className={`lp-page ${animCls(currentPage.animation, true)}`} key={currentPage.id} style={{ ...animStyle(currentPage.animation), background: currentPage.backgroundColor ?? undefined }}>
              {asset(currentPage.backgroundAssetId) && <img className="lp-page-bg" src={asset(currentPage.backgroundAssetId)!.url} alt="" />}
              <header className="lp-page-head"><h2>{currentPage.title}</h2>{currentPage.description && <p>{currentPage.description}</p>}</header>
              {renderWidgets(currentPage.widgets, currentPage.layout) || <p className="lp-muted">Nothing here yet.</p>}
            </div>
          ) : (
            <article key={replayKey} className={`lp-card layout-${card.layout} hv-${card.hover} ${card.tilt3d ? "tilt" : ""} ${card.mouseGlow ? "mglow" : ""} ${card.borderGradient ? "bgrad" : ""} ${animCls(A.profile, true)}`}
              style={animStyle(A.profile)} onPointerMove={onMove} onPointerLeave={onLeave}>
              {showBanner && (
                <div className="lp-banner" style={{ height: bn.height }}>
                  <img src={bannerAsset!.url} alt="" style={{ objectPosition: `${bn.posX}% ${bn.posY}%`, transform: `scale(${bn.scale})`, filter: bn.blur ? `blur(${bn.blur}px)` : undefined, opacity: bn.opacity / 100 }} />
                  <div className="lp-fill" style={{ background: bn.overlayColor }} />
                </div>
              )}
              <div className="lp-head">
                {avatarAsset && (
                  <div className={`lp-avatar shape-${av.shape} ${animCls(A.avatar, true)}`} style={{ ...animStyle(A.avatar), width: av.size, height: av.size, borderWidth: av.borderWidth, borderColor: av.borderColor, boxShadow: av.glow ? `0 0 ${av.glow / 2}px ${rgba(card.glowColor, av.glow / 100)}` : undefined, marginTop: showBanner ? -av.size / 2 : undefined }}>
                    <img src={avatarAsset.kind === "image" ? avatarAsset.url : avatarAsset.thumbUrl ?? avatarAsset.url} alt={`${name}'s avatar`} style={{ transform: `translate(${av.offsetX}%, ${av.offsetY}%) scale(${av.zoom})` }} />
                  </div>
                )}
                <div className="lp-id">
                  <div className={`lp-name-row ${cfg.badgesStyle.position === "below" ? "stacked" : ""}`}>
                    <EffectText as="h1" className={`lp-name ${ty.nameGradient ? "grad" : ""} ${animCls(A.name, true)}`} style={{ ...nameStyle, ...animStyle(A.name) }}
                      text={name} effect={ty.nameEffect} speed={ty.effectSpeed} loop={ty.effectLoop} />
                    {badges.length > 0 && (
                      <div className={`lp-badges ${cfg.badgesStyle.background ? "chip" : ""}`} role="list" aria-label="Badges">
                        {badges.map((b, i) => <span role="listitem" key={b.id} className={animCls(A.badges, true)} style={animStyle(A.badges, i)}><BadgeIcon b={b} size={cfg.badgesStyle.size} /></span>)}
                      </div>
                    )}
                  </div>
                  {cfg.identity.status && <div className="lp-status">{cfg.identity.status}</div>}
                </div>
              </div>
              {cfg.identity.bio && <EffectText as="p" className={`lp-bio ${animCls(A.bio, true)}`} style={animStyle(A.bio)} text={cfg.identity.bio} effect={ty.bioEffect} speed={ty.effectSpeed} loop={ty.effectLoop} />}
              {meta.length > 0 && <div className="lp-meta">{meta}</div>}
              {(cfg.identity.website || cfg.identity.languages.length > 0) && (
                <div className="lp-meta">
                  {cfg.identity.website && <a href={cfg.identity.website} target="_blank" rel="noopener noreferrer nofollow ugc"><LuLink />{cfg.identity.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}
                  {cfg.identity.languages.length > 0 && <span>{cfg.identity.languages.join(", ")}</span>}
                </div>
              )}
              <Links cfg={cfg} asset={asset} username={payload.user.username} track={mode === "public"} mode={mode} />
              {cfg.music.position === "card" && (cfg.music.layout !== "background" || !music) && music && !cfg.widgets.some((w) => w.type === "musicplayer") && <div className="lp-music">{music}</div>}
              {embeds}
              {card.layout === "wide" ? <div className="lp-wide-body">{renderWidgets(cfg.widgets, "grid")}</div> : renderWidgets(cfg.widgets)}
            </article>
          )}
          {cfg.music.position === "bottom" && music && <div className="lp-bar bottom">{music}</div>}
          {cfg.music.layout === "background" && cfg.music.position === "card" && music}
        </div>
      )}
      {!entered && <EntryScreen cfg={cfg} asset={asset} onEnter={doEnter} onGesture={startMusic} />}
      <Cursor cfg={cfg} asset={asset} host={host} />
    </div>
  );
}
