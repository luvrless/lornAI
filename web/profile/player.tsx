/** @jsxRuntime automatic @jsxImportSource react */
/**
 * Music: a persistent audio engine (one <audio> element for the page's life)
 * plus player UIs that subscribe to it. Because the engine outlives the UI,
 * the entry screen's click can start playback inside the user gesture, which
 * is what browsers' autoplay policies require.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { LuPlay, LuPause, LuSkipForward, LuSkipBack, LuVolume2, LuVolumeX, LuShuffle, LuRepeat, LuDisc3 } from "react-icons/lu";

export interface Track { id: string; title: string; artist: string; url: string; cover: string | null; lyrics: { t: number; text: string }[] }

interface State { idx: number; playing: boolean; time: number; dur: number; vol: number; muted: boolean; shuffle: boolean; loop: "none" | "one" | "all"; blocked: boolean }

export class MusicEngine {
  audio: HTMLAudioElement | null = null;
  state: State;
  private subs = new Set<() => void>();
  private ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  onPlay?: (t: Track) => void;

  constructor(public tracks: Track[], o: { volume: number; shuffle: boolean; loop: State["loop"] }) {
    this.state = { idx: 0, playing: false, time: 0, dur: 0, vol: o.volume / 100, muted: false, shuffle: o.shuffle, loop: o.loop, blocked: false };
    if (typeof Audio === "undefined" || !tracks.length) return;
    const a = (this.audio = new Audio());
    a.preload = "metadata";
    a.src = tracks[0].url;
    a.volume = this.state.vol;
    a.addEventListener("play", () => { this.set({ playing: true, blocked: false }); this.onPlay?.(this.track); });
    a.addEventListener("pause", () => this.set({ playing: false }));
    a.addEventListener("timeupdate", () => this.set({ time: a.currentTime }));
    a.addEventListener("loadedmetadata", () => this.set({ dur: a.duration }));
    a.addEventListener("ended", () => {
      if (this.state.loop === "one") { a.currentTime = 0; this.play(); }
      else if (this.state.loop === "all" || this.state.shuffle || this.state.idx < this.tracks.length - 1) this.next(1, true);
    });
  }
  get track() { return this.tracks[this.state.idx]; }
  private set(p: Partial<State>) { this.state = { ...this.state, ...p }; this.subs.forEach((f) => f()); }
  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  snapshot = () => this.state;

  async play() {
    if (!this.audio) return;
    try { await this.audio.play(); } catch { this.set({ blocked: true }); }
  }
  pause() { this.audio?.pause(); }
  toggle() { if (this.state.playing) this.pause(); else this.play(); }
  next(dir = 1, autoplay = this.state.playing) {
    const n = this.tracks.length;
    if (!n || !this.audio) return;
    const idx = this.state.shuffle && n > 1 ? (this.state.idx + 1 + Math.floor(Math.random() * (n - 1))) % n : (this.state.idx + dir + n) % n;
    this.set({ idx, time: 0, dur: 0 });
    this.audio.src = this.tracks[idx].url;
    if (autoplay) this.play();
  }
  seek(frac: number) { if (this.audio && this.state.dur) this.audio.currentTime = frac * this.state.dur; }
  setVolume(v: number) { if (this.audio) this.audio.volume = v; this.set({ vol: v, muted: false }); }
  toggleMute() { const m = !this.state.muted; if (this.audio) this.audio.volume = m ? 0 : this.state.vol; this.set({ muted: m }); }
  toggleShuffle() { this.set({ shuffle: !this.state.shuffle }); }
  cycleLoop() { this.set({ loop: this.state.loop === "none" ? "all" : this.state.loop === "all" ? "one" : "none" }); }
  /** Real frequency data for the waveform layout (same-origin audio only). */
  ensureAnalyser() {
    if (this.analyser || !this.audio) return this.analyser;
    if (new URL(this.track.url, location.href).origin !== location.origin) return null; // CORS-tainted audio would be silenced
    try {
      this.ctx = new AudioContext();
      const src = this.ctx.createMediaElementSource(this.audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      src.connect(this.analyser); this.analyser.connect(this.ctx.destination);
    } catch { this.analyser = null; }
    return this.analyser;
  }
  destroy() { this.audio?.pause(); if (this.audio) this.audio.removeAttribute("src"); this.ctx?.close().catch(() => {}); this.subs.clear(); }
}

const fmt = (s: number) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
const SERVER: State = { idx: 0, playing: false, time: 0, dur: 0, vol: 0.5, muted: false, shuffle: false, loop: "all", blocked: false };

export function MusicPlayer({ engine, layout, accent }: { engine: MusicEngine; layout: string; accent: string }) {
  const s = useSyncExternalStore(engine.subscribe, engine.snapshot, () => SERVER);
  const bars = useRef<HTMLCanvasElement>(null);
  const t = engine.tracks[s.idx];

  useEffect(() => {
    if (layout !== "waveform" || !s.playing || !bars.current) return;
    const an = engine.ensureAnalyser();
    if (!an) return;
    const data = new Uint8Array(an.frequencyBinCount), c = bars.current, g = c.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      an.getByteFrequencyData(data);
      c.width = c.clientWidth * 2; c.height = c.clientHeight * 2;
      g.clearRect(0, 0, c.width, c.height);
      const bw = c.width / data.length;
      g.fillStyle = accent;
      data.forEach((v, i) => { const h = Math.max(3, (v / 255) * c.height); g.fillRect(i * bw + 1, (c.height - h) / 2, bw - 3, h); });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [layout, s.playing, accent, engine]);

  if (!t) return null;
  const pct = s.dur ? (s.time / s.dur) * 100 : 0;
  const line = t.lyrics.length ? [...t.lyrics].reverse().find((l) => l.t <= s.time)?.text ?? "" : "";
  const many = engine.tracks.length > 1;
  const PlayBtn = <button className="mp-btn mp-main" onClick={() => engine.toggle()} aria-label={s.playing ? "Pause" : "Play"}>{s.playing ? <LuPause /> : <LuPlay />}</button>;
  const controls = (
    <div className="mp-controls">
      {many && <button className="mp-btn" onClick={() => engine.next(-1)} aria-label="Previous track"><LuSkipBack /></button>}
      {PlayBtn}
      {many && <button className="mp-btn" onClick={() => engine.next(1)} aria-label="Next track"><LuSkipForward /></button>}
    </div>
  );
  const progress = (
    <div className="mp-progress">
      <span>{fmt(s.time)}</span>
      <input type="range" min={0} max={100} step={0.1} value={pct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => engine.seek(Number(e.target.value) / 100)} aria-label="Seek" style={{ ["--p" as any]: `${pct}%` }} />
      <span>{fmt(s.dur)}</span>
    </div>
  );
  const volume = (
    <div className="mp-vol">
      <button className="mp-btn" onClick={() => engine.toggleMute()} aria-label={s.muted ? "Unmute" : "Mute"}>{s.muted || s.vol === 0 ? <LuVolumeX /> : <LuVolume2 />}</button>
      <input type="range" min={0} max={1} step={0.01} value={s.muted ? 0 : s.vol} onChange={(e: React.ChangeEvent<HTMLInputElement>) => engine.setVolume(Number(e.target.value))} aria-label="Volume" />
    </div>
  );
  const extras = many && (
    <div className="mp-extras">
      <button className="mp-btn" aria-pressed={s.shuffle} onClick={() => engine.toggleShuffle()} aria-label="Shuffle"><LuShuffle /></button>
      <button className="mp-btn" aria-pressed={s.loop !== "none"} onClick={() => engine.cycleLoop()} aria-label={`Repeat ${s.loop}`}><LuRepeat />{s.loop === "one" && <small>1</small>}</button>
    </div>
  );
  const cover = (cls: string) => (t.cover ? <img className={cls} src={t.cover} alt="" /> : <div className={cls + " mp-cover-empty"}><LuDisc3 /></div>);
  const hint = s.blocked && !s.playing && <div className="mp-hint">Tap play to start the music</div>;

  if (layout === "background") return <div className="mp mp-background"><button className="mp-btn mp-float" onClick={() => engine.toggle()} aria-label={s.playing ? "Pause music" : "Play music"}>{s.playing ? <LuVolume2 /> : <LuVolumeX />}</button></div>;
  if (layout === "minimal") return <div className="mp mp-minimal">{PlayBtn}<div className="grow"><div className="mp-title">{t.title}</div><div className="mp-bar"><i style={{ width: `${pct}%` }} /></div></div>{hint}</div>;
  if (layout === "marquee") return <div className="mp mp-marquee">{PlayBtn}<div className="mp-scroll"><span>{t.title}{t.artist && ` — ${t.artist}`}</span><span aria-hidden>{t.title}{t.artist && ` — ${t.artist}`}</span></div>{volume}</div>;
  if (layout === "vinyl") return (
    <div className="mp mp-vinyl">
      <div className={"mp-disc" + (s.playing ? " spin" : "")}>{cover("mp-disc-label")}</div>
      <div className="grow"><div className="mp-title">{t.title}</div><div className="mp-artist">{t.artist}</div>{progress}<div className="mp-row">{controls}{volume}</div>{hint}</div>
    </div>
  );
  if (layout === "lyrics") return (
    <div className="mp mp-lyrics">
      <div className="mp-row">{cover("mp-cover")}<div className="grow"><div className="mp-title">{t.title}</div><div className="mp-artist">{t.artist}</div></div>{controls}</div>
      <div className="mp-lyric" aria-live="polite">{line || (t.lyrics.length ? "…" : "No lyrics for this track")}</div>{progress}{hint}
    </div>
  );
  return (
    <div className={"mp mp-" + (layout === "waveform" ? "waveform" : "compact")}>
      <div className="mp-row">{cover("mp-cover")}<div className="grow"><div className="mp-title">{t.title}</div><div className="mp-artist">{t.artist}</div></div>{extras}</div>
      {layout === "waveform" && <canvas ref={bars} className="mp-wave" aria-hidden />}
      {progress}<div className="mp-row">{controls}{volume}</div>{hint}
    </div>
  );
}
