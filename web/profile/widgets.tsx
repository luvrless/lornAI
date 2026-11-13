/** @jsxRuntime automatic @jsxImportSource react */
/**
 * Widget renderers. Keys match shared/widgets.ts; adding a widget means one
 * entry there and one component here — the profile renderer never changes.
 */
import { useEffect, useState, type ReactNode } from "react";
import { LuMapPin, LuClock, LuCalendar, LuStar, LuUsers, LuExternalLink, LuCpu, LuCircleAlert, LuThermometer, LuWind, LuGitBranch } from "react-icons/lu";
import { SiGithub, SiRoblox, SiSteam, SiTwitch, SiYoutube, SiDiscord } from "react-icons/si";

export interface WidgetCtx {
  asset(id: string | null | undefined): { url: string; thumbUrl: string | null; mime: string; kind: string } | null;
  data: any; // integration result for this widget
  renderMusic?: () => ReactNode;
}
type W = (p: { config: any; ctx: WidgetCtx }) => ReactNode;

const Title = ({ children }: { children: ReactNode }) => (children ? <h3 className="w-title">{children}</h3> : null);
const Ext = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">{children}</a>;
const nf = (n: number | null | undefined) => (n == null ? "—" : Intl.NumberFormat("en", { notation: n >= 10000 ? "compact" : "standard" }).format(n));

function Remote({ ctx, render, label }: { ctx: WidgetCtx; render: (d: any) => ReactNode; label: string }) {
  const r = ctx.data;
  if (!r || r.status === "pending") return <div className="w-loading"><span className="w-skel" /><span className="w-skel short" /></div>;
  if (r.status === "not_configured") return <div className="w-unavail"><LuCircleAlert /> {label} isn't connected on this server yet</div>;
  if (r.status === "error") return <div className="w-unavail"><LuCircleAlert /> {label}: {r.error}</div>;
  return <>{render(r.data)}</>;
}

function useNow(ms = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), ms); return () => clearInterval(i); }, [ms]);
  return now;
}

const WEATHER: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };

export const WIDGET_COMPONENTS: Record<string, W> = {
  about: ({ config }) => <><Title>{config.title}</Title><p className="w-text">{config.text}</p></>,
  text: ({ config }) => <><Title>{config.title}</Title><p className="w-text" style={{ textAlign: config.align }}>{config.text}</p></>,
  info: ({ config }) => <dl className="w-rows">{config.rows.map((r: any, i: number) => <div key={i}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>,
  inforows: ({ config }) => <dl className="w-rows">{config.rows.map((r: any, i: number) => <div key={i}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>,
  languages: ({ config }) => <><Title>Languages</Title><div className="w-tags">{config.items.map((l: any, i: number) => <span key={i} className="w-tag">{l.name}<small>{l.level}</small></span>)}</div></>,
  location: ({ config }) => {
    const now = useNow(30000);
    let local = "";
    try { if (now && config.timezone) local = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: config.timezone }); } catch { /* invalid tz */ }
    return <div className="w-inline"><LuMapPin /><span>{config.place}</span>{local && <span className="w-dim">{local} local time</span>}</div>;
  },
  skills: ({ config }) => <><Title>Skills</Title><div className="w-skills">{config.items.map((s: any, i: number) => <div key={i}><span>{s.name}</span><div className="w-meter"><i style={{ width: `${s.level}%` }} /></div></div>)}</div></>,
  projects: ({ config, ctx }) => <><Title>Projects</Title><div className="w-cards">{config.items.map((p: any, i: number) => {
    const img = ctx.asset(p.imageAssetId);
    const body = <>{img && <img src={img.thumbUrl ?? img.url} alt="" loading="lazy" />}<b>{p.name}</b><span>{p.description}</span></>;
    return <div key={i} className="w-card">{p.url ? <Ext href={p.url}>{body}</Ext> : body}</div>;
  })}</div></>,
  games: ({ config, ctx }) => <><Title>Games</Title><div className="w-list">{config.items.map((g: any, i: number) => {
    const img = ctx.asset(g.imageAssetId);
    return <div key={i} className="w-li">{img && <img src={img.thumbUrl ?? img.url} alt="" loading="lazy" />}<b>{g.name}</b>{g.rank && <span className="w-tag">{g.rank}</span>}{g.hours != null && <span className="w-dim">{nf(g.hours)} h</span>}</div>;
  })}</div></>,
  setup: ({ config }) => <><Title>Setup</Title><dl className="w-rows">{config.items.map((r: any, i: number) => <div key={i}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></>,
  hardware: ({ config }) => <><Title><LuCpu /> Hardware</Title><dl className="w-rows">{(["cpu", "gpu", "ram", "storage", "monitor", "peripherals"] as const).filter((k) => config[k]).map((k) => <div key={k}><dt>{k.toUpperCase() === "RAM" || k === "cpu" || k === "gpu" ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1)}</dt><dd>{config[k]}</dd></div>)}</dl></>,
  gamestats: ({ config }) => <><Title>{config.game}</Title><div className="w-stats">{config.stats.map((s: any, i: number) => <div key={i}><b>{s.value}</b><span>{s.label}</span></div>)}</div></>,
  collection: ({ config, ctx }) => <><Title>{config.title}</Title><div className="w-grid">{config.items.map((g: any, i: number) => { const a = ctx.asset(g.imageAssetId); return <figure key={i}>{a ? <img src={a.thumbUrl ?? a.url} alt={g.name} loading="lazy" /> : <div className="w-ph" />}<figcaption>{g.name}</figcaption></figure>; })}</div></>,
  crosshair: ({ config }) => {
    const c = config, L = c.length * 2, G = c.gap * 2, T = c.thickness;
    return <><Title>{c.game} crosshair</Title><div className="w-inline"><svg width="64" height="64" viewBox="-32 -32 64 64" aria-label="Crosshair preview">
      {[[0, -1], [0, 1], [-1, 0], [1, 0]].map(([x, y], i) => <rect key={i} x={x === 0 ? -T / 2 : x < 0 ? -(G + L) : G} y={y === 0 ? -T / 2 : y < 0 ? -(G + L) : G} width={x === 0 ? T : L} height={y === 0 ? T : L} fill={c.color} />)}
      {c.dot && <rect x={-T / 2} y={-T / 2} width={T} height={T} fill={c.color} />}</svg>
      {c.code && <code className="w-code">{c.code}</code>}</div></>;
  },
  gallery: ({ config, ctx }) => {
    const [open, setOpen] = useState<number | null>(null);
    const imgs = config.images.map((g: any) => ({ ...g, a: ctx.asset(g.assetId) })).filter((g: any) => g.a);
    return <><Title>{config.title}</Title><div className="w-gallery" style={{ gridTemplateColumns: `repeat(${config.columns}, 1fr)` }}>
      {imgs.map((g: any, i: number) => <button key={i} onClick={() => setOpen(i)} aria-label={g.caption || `Image ${i + 1}`}><img src={g.a.thumbUrl ?? g.a.url} alt={g.caption} loading="lazy" /></button>)}</div>
      {open != null && <div className="w-lightbox" role="dialog" aria-modal onClick={() => setOpen(null)}><img src={imgs[open].a.url} alt={imgs[open].caption} />{imgs[open].caption && <p>{imgs[open].caption}</p>}</div>}</>;
  },
  videos: ({ config, ctx }) => <><Title>{config.title}</Title><div className="w-videos">{config.videos.map((v: any, i: number) => { const a = ctx.asset(v.assetId); return a && <figure key={i}><video src={a.url} poster={a.thumbUrl ?? undefined} controls preload="none" playsInline />{v.caption && <figcaption>{v.caption}</figcaption>}</figure>; })}</div></>,
  musiccollection: ({ config, ctx }) => <><Title>{config.title}</Title><div className="w-list">{config.items.map((m: any, i: number) => { const a = ctx.asset(m.coverAssetId); const inner = <>{a && <img src={a.thumbUrl ?? a.url} alt="" loading="lazy" />}<b>{m.title}</b><span className="w-dim">{m.artist}</span></>; return <div key={i} className="w-li">{m.url ? <Ext href={m.url}>{inner}</Ext> : inner}</div>; })}</div></>,
  musicplayer: ({ ctx }) => <>{ctx.renderMusic?.() ?? <div className="w-unavail">Add tracks in the Music section</div>}</>,
  embed: ({ config }) => <Embed provider={config.provider} url={config.url} />,
  spotify: ({ config }) => <Embed provider="spotify" url={config.url} />,
  github: ({ config, ctx }) => <Remote ctx={ctx} label="GitHub" render={(d) => <>
    <div className="w-head"><SiGithub /><Ext href={d.url}><b>{d.name || d.login}</b></Ext><span className="w-dim">@{d.login}</span></div>
    <div className="w-stats"><div><b>{nf(d.publicRepos)}</b><span>repos</span></div><div><b>{nf(d.stars)}</b><span>stars</span></div><div><b>{nf(d.followers)}</b><span>followers</span></div></div>
    {d.languages?.length > 0 && <div className="w-tags">{d.languages.map((l: any) => <span key={l.name} className="w-tag">{l.name}</span>)}</div>}
    {config.showRepos && <div className="w-list">{d.repos.slice(0, 4).map((r: any) => <div key={r.name} className="w-li"><LuGitBranch /><Ext href={r.url}><b>{r.name}</b></Ext><span className="w-dim"><LuStar /> {r.stars}</span></div>)}</div>}
  </>} />,
  roblox: ({ ctx }) => <Remote ctx={ctx} label="Roblox" render={(d) => <div className="w-head">
    {d.avatar ? <img className="w-av" src={d.avatar} alt="" /> : <SiRoblox />}<div><Ext href={d.url}><b>{d.displayName}</b></Ext><div className="w-dim">@{d.name}</div></div>
    <div className="w-stats sm"><div><b>{nf(d.friends)}</b><span>friends</span></div><div><b>{nf(d.followers)}</b><span>followers</span></div></div></div>} />,
  steam: ({ config, ctx }) => <Remote ctx={ctx} label="Steam" render={(d) => <>
    <div className="w-head">{d.avatar ? <img className="w-av" src={d.avatar} alt="" /> : <SiSteam />}<Ext href={d.url}><b>{d.name}</b></Ext>{d.gameCount != null && <span className="w-dim">{d.gameCount} games</span>}</div>
    {config.showGames && <div className="w-list">{(d.recent.length ? d.recent : d.top).slice(0, 4).map((g: any) => <div key={g.appid} className="w-li">{g.icon && <img src={g.icon} alt="" />}<b>{g.name}</b><span className="w-dim">{g.hours2w != null ? `${g.hours2w} h past 2 weeks` : `${g.hours} h`}</span></div>)}</div>}
  </>} />,
  twitch: ({ ctx }) => <Remote ctx={ctx} label="Twitch" render={(d) => <div className="w-head">
    {d.avatar ? <img className="w-av" src={d.avatar} alt="" /> : <SiTwitch />}<div className="grow"><Ext href={d.url}><b>{d.name}</b></Ext><div className="w-dim">{d.live ? `${d.game ?? "Live"} · ${nf(d.viewers)} watching` : "Offline"}</div></div>
    {d.live && <span className="w-live">Live</span>}</div>} />,
  youtube: ({ ctx }) => <Remote ctx={ctx} label="YouTube" render={(d) => <>
    <div className="w-head">{d.avatar ? <img className="w-av" src={d.avatar} alt="" /> : <SiYoutube />}<Ext href={d.url}><b>{d.title}</b></Ext><span className="w-dim">{d.subscribers != null ? `${nf(d.subscribers)} subscribers` : ""}</span></div>
    <div className="w-grid">{d.latest.map((v: any) => <figure key={v.id}><Ext href={`https://youtube.com/watch?v=${v.id}`}><img src={v.thumb} alt="" loading="lazy" /></Ext><figcaption>{v.title}</figcaption></figure>)}</div>
  </>} />,
  discord: ({ ctx }) => <Remote ctx={ctx} label="Discord" render={(d) => <div className="w-head">{d.avatar ? <img className="w-av" src={d.avatar} alt="" /> : <SiDiscord />}<div><b>{d.username}</b><div className="w-dim">Connected Discord account</div></div></div>} />,
  discordserver: ({ ctx }) => <Remote ctx={ctx} label="Discord server" render={(d) => <div className="w-head">
    {d.icon ? <img className="w-av" src={d.icon} alt="" /> : <SiDiscord />}<div className="grow"><b>{d.name}</b><div className="w-dim"><LuUsers /> {nf(d.members)} members · {nf(d.online)} online</div></div>
    <Ext href={d.url}><span className="w-join">Join</span></Ext></div>} />,
  calendar: ({ config }) => {
    const today = new Date().toISOString().slice(0, 10);
    const ev = [...config.events].sort((a: any, b: any) => a.date.localeCompare(b.date)).filter((e: any) => e.date >= today);
    return <><Title><LuCalendar /> {config.title}</Title>{ev.length ? <div className="w-list">{ev.slice(0, 6).map((e: any, i: number) => <div key={i} className="w-li"><span className="w-date">{new Date(e.date + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}</span><b>{e.title}</b></div>)}</div> : <p className="w-dim">Nothing coming up</p>}</>;
  },
  countdown: ({ config }) => {
    const now = useNow(1000);
    if (!config.target) return <p className="w-dim">No date set</p>;
    const diff = now ? Math.max(0, new Date(config.target).getTime() - now.getTime()) : 0;
    const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
    return <><Title>{config.title}</Title><div className="w-count">{([[d, "days"], [h, "hours"], [m, "min"], [s, "sec"]] as const).map(([v, l]) => <div key={l}><b>{now ? String(v).padStart(2, "0") : "--"}</b><span>{l}</span></div>)}</div></>;
  },
  clock: ({ config }) => {
    const now = useNow(1000);
    let s = "--:--";
    try { if (now) s = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: config.seconds ? "2-digit" : undefined, hour12: config.hour12, timeZone: config.timezone || undefined }); } catch { s = "Invalid timezone"; }
    return <div className="w-clock"><LuClock /><b>{s}</b><span className="w-dim">{config.timezone}</span></div>;
  },
  timezone: ({ config }) => {
    const now = useNow(30000);
    let s = "", off = "";
    try {
      if (now) {
        s = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: config.timezone });
        off = new Intl.DateTimeFormat("en", { timeZone: config.timezone, timeZoneName: "shortOffset" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";
      }
    } catch { s = "Invalid timezone"; }
    return <div className="w-inline"><LuClock /><b>{config.label || config.timezone}</b><span>{s}</span><span className="w-dim">{off}</span></div>;
  },
  weather: ({ config, ctx }) => <Remote ctx={ctx} label="Weather" render={(d) => {
    const t = config.unit === "f" ? d.temperatureC * 9 / 5 + 32 : d.temperatureC;
    return <div className="w-head"><LuThermometer /><b className="w-big">{Math.round(t)}°{config.unit.toUpperCase()}</b><div><div>{WEATHER[d.code] ?? "—"}</div><div className="w-dim">{config.place} · <LuWind /> {Math.round(d.windKmh)} km/h</div></div></div>;
  }} />,
  list: ({ config }) => { const L = config.ordered ? "ol" : "ul"; return <><Title>{config.title}</Title><L className="w-ul">{config.items.map((x: any, i: number) => <li key={i}>{x.text}</li>)}</L></>; },
};

export function Embed({ provider, url }: { provider: string; url: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-embed w-loading"><span className="w-skel" /></div>; // iframes load after hydration
  const src = embedSrc(provider, url);
  if (!src) return <div className="w-unavail"><LuCircleAlert /> This link can't be embedded</div>;
  const tall = provider === "spotify" && /playlist|album/.test(url);
  return <div className={"w-embed " + provider}><iframe src={src} title={`${provider} embed`} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" style={{ height: provider === "youtube" || provider === "twitch" ? undefined : tall ? 352 : 152 }} sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" /></div>;
}

/** Official embed URLs only; unrecognised links are not embedded. */
export function embedSrc(provider: string, url: string): string | null {
  try {
    const u = new URL(url);
    if (provider === "youtube") {
      const id = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : u.searchParams.get("v") ?? u.pathname.match(/\/(embed|shorts)\/([\w-]{11})/)?.[2];
      return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (provider === "spotify" && u.hostname === "open.spotify.com") {
      const m = u.pathname.match(/^\/(?:intl-\w+\/)?(track|album|playlist|artist|episode|show)\/(\w+)/);
      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
    }
    if (provider === "soundcloud" && u.hostname.endsWith("soundcloud.com")) return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&visual=false`;
    if (provider === "applemusic" && u.hostname === "music.apple.com") return `https://embed.music.apple.com${u.pathname}`;
    if (provider === "twitch" && u.hostname.endsWith("twitch.tv")) {
      const ch = u.pathname.split("/")[1];
      return ch && /^\w{3,25}$/.test(ch) ? `https://player.twitch.tv/?channel=${ch}&parent=${location.hostname}&muted=true` : null;
    }
  } catch { /* fallthrough */ }
  return null;
}

export { LuExternalLink };
