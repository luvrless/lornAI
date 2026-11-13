/** @jsxRuntime automatic @jsxImportSource react */
/** Shared UI kit: controls, overlays, feedback, data display. */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { LuX, LuCircleCheck, LuCircleAlert, LuInfo, LuCopy, LuCheck, LuInbox } from "react-icons/lu";
import { ApiError, get } from "./api.ts";

// ------------------------------------------------------------------ data hooks

export function useQuery<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await get<T>(path);
      if (n === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === seq.current) setError(e as ApiError);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload: load, setData };
}

/** Run an async action with loading state and toast on failure/success. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setBusy(true);
    try {
      const r = await fn();
      if (success) toast(success, "ok");
      return r;
    } catch (e) {
      toast((e as Error).message, "bad");
      return undefined;
    } finally { setBusy(false); }
  }, []);
  return { busy, run };
}

// ------------------------------------------------------------------ toasts

type Toast = { id: number; msg: string; kind: "ok" | "bad" | "info" };
let toasts: Toast[] = [];
const toastSubs = new Set<() => void>();
export function toast(msg: string, kind: Toast["kind"] = "info") {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, msg, kind }].slice(-4);
  toastSubs.forEach((f) => f());
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); toastSubs.forEach((f) => f()); }, kind === "bad" ? 6500 : 3500);
}
export function Toasts() {
  const list = useSyncExternalStore((f) => { toastSubs.add(f); return () => toastSubs.delete(f); }, () => toasts, () => toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === "ok" ? <LuCircleCheck color="var(--ok)" /> : t.kind === "bad" ? <LuCircleAlert color="var(--bad)" /> : <LuInfo color="var(--halo)" />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ buttons & controls

export function Button({ children, kind, size, busy, icon, className, ...rest }: { kind?: "primary" | "danger" | "ghost"; size?: "sm" | "lg"; busy?: boolean; icon?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} disabled={rest.disabled || busy} aria-busy={busy || undefined} className={["btn", kind, size, icon && "icon", className].filter(Boolean).join(" ")}>
      {busy && <span className="spin" aria-hidden />}{children}
    </button>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label?: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="err" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({ label, hint, error, value, onChange, textarea, ...rest }: { label?: string; hint?: ReactNode; error?: string; value: string; onChange: (v: string) => void; textarea?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      {textarea
        ? <textarea id={id} className="textarea" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} maxLength={rest.maxLength} placeholder={rest.placeholder} rows={4} />
        : <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} {...rest} />}
    </Field>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function ToggleRow({ label, hint, checked, onChange, disabled }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="spread">
      <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</div>{hint && <div className="small dim">{hint}</div>}</div>
      <Toggle checked={checked} onChange={onChange} label={typeof label === "string" ? label : "Toggle"} disabled={disabled} />
    </div>
  );
}

export function Slider({ value, min, max, step = 1, onChange, label, unit = "" }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; unit?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (s: string) => { const n = Number(s); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))); else setText(String(value)); };
  return (
    <div className="slider">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <input className="input" value={text} aria-label={`${label} value${unit ? ` in ${unit}` : ""}`} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)} />
    </div>
  );
}

export function ColorField({ value, onChange, label, alpha }: { value: string; onChange: (v: string) => void; label: string; alpha?: boolean }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const base = value.slice(0, 7), a = value.length === 9 ? value.slice(7) : "";
  return (
    <div className="swatch">
      <input type="color" value={base} onChange={(e) => onChange(e.target.value + a)} aria-label={label} />
      <input className="input" value={text} onChange={(e) => { setText(e.target.value); if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(e.target.value)) onChange(e.target.value); }} aria-label={`${label} hex`} />
      {alpha && <input type="range" min={0} max={255} value={a ? parseInt(a, 16) : 255} onChange={(e) => onChange(base + Number(e.target.value).toString(16).padStart(2, "0"))} aria-label={`${label} opacity`} style={{ width: 80, accentColor: "var(--signal)" }} />}
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, label, id }: { value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[]; label?: string; id?: string }) {
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
      {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{humanize(o)}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: ReactNode })[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        return <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{typeof o === "string" ? humanize(o) : o.label}</button>;
      })}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[] }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>{t.label}</button>)}
    </div>
  );
}

export const humanize = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// ------------------------------------------------------------------ overlays

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button:not(.modal-x)")?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => { removeEventListener("keydown", key); prev?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`panel modal ${wide ? "wide" : ""}`} role="dialog" aria-modal aria-label={typeof title === "string" ? title : undefined}>
        <div className="panel-head"><h2>{title}</h2><Button kind="ghost" icon size="sm" className="modal-x" onClick={onClose} aria-label="Close"><LuX /></Button></div>
        <div className="panel-body stack-16">{children}</div>
        {footer && <div className="panel-head" style={{ borderTop: "1px solid var(--hair)", borderBottom: 0, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>, document.body);
}

type ConfirmOpts = { title: string; body?: ReactNode; confirm?: string; danger?: boolean; typeToConfirm?: string; reason?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<false | { reason: string }>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: false | { reason: string }) => void }) | null>(null);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const ask = useCallback((o: ConfirmOpts) => new Promise<false | { reason: string }>((resolve) => { setTyped(""); setReason(""); setState({ ...o, resolve }); }), []);
  const close = (v: false | { reason: string }) => { state?.resolve(v); setState(null); };
  const ok = (!state?.typeToConfirm || typed === state.typeToConfirm) && (!state?.reason || reason.trim().length >= 3);
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <Modal title={state.title} onClose={() => close(false)} footer={<>
          <Button kind="ghost" onClick={() => close(false)}>Cancel</Button>
          <Button kind={state.danger ? "danger" : "primary"} disabled={!ok} onClick={() => close({ reason })}>{state.confirm ?? "Confirm"}</Button>
        </>}>
          {state.body && <div className="muted">{state.body}</div>}
          {state.reason && <TextField label="Reason (recorded in the audit log)" value={reason} onChange={setReason} maxLength={500} />}
          {state.typeToConfirm && <TextField label={<>Type <b>{state.typeToConfirm}</b> to confirm</> as any} value={typed} onChange={setTyped} />}
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}

export function Menu({ trigger, items }: { trigger: (open: () => void) => ReactNode; items: { label: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("mousedown", off); addEventListener("keydown", key);
    return () => { removeEventListener("mousedown", off); removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {trigger(() => setOpen((o) => !o))}
      {open && <div className="menu" role="menu" style={{ right: 0, top: "calc(100% + 4px)" }}>
        {items.filter((i) => !i.hidden).map((i, k) => <button key={k} role="menuitem" style={i.danger ? { color: "var(--bad)" } : undefined} onClick={() => { setOpen(false); i.onClick(); }}>{i.label}</button>)}
      </div>}
    </div>
  );
}

// ------------------------------------------------------------------ display

export function Skeleton({ h = 16, w = "100%", style }: { h?: number; w?: number | string; style?: CSSProperties }) {
  return <div className="skel" style={{ height: h, width: w, ...style }} aria-hidden />;
}
export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return <div className="col" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={i === 0 ? 22 : 14} w={i === 0 ? "40%" : `${90 - i * 12}%`} />)}</div>;
}
export function ErrorBlock({ error, retry }: { error: ApiError; retry?: () => void }) {
  return <div className="banner bad"><LuCircleAlert color="var(--bad)" /><div className="grow">{error.message}</div>{retry && <Button size="sm" onClick={retry}>Try again</Button>}</div>;
}
export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty">{icon ?? <LuInbox />}<div style={{ color: "var(--ice)", fontWeight: 600 }}>{title}</div>{children && <div className="small" style={{ maxWidth: "46ch" }}>{children}</div>}{action}</div>;
}
export function Stat({ k, v, d }: { k: string; v: ReactNode; d?: { value: number; label?: string } | null }) {
  return (
    <div className="panel stat">
      <div className="k">{k}</div><div className="v">{v}</div>
      {d && isFinite(d.value) && <div className={`d ${d.value >= 0 ? "up" : "down"}`}>{d.value >= 0 ? "+" : ""}{(d.value * 100).toFixed(0)}% {d.label ?? "vs previous period"}</div>}
    </div>
  );
}
export const delta = (a: number, b: number) => (b ? (a - b) / b : a ? 1 : 0);

export function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <Button size="sm" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? <LuCheck /> : <LuCopy />}{done ? "Copied" : label}</Button>;
}

export function LineChart({ series, labels, height = 220 }: { series: { name: string; values: number[]; dashed?: boolean }[]; labels: string[]; height?: number }) {
  const W = 800, H = height, P = { l: 36, r: 10, t: 12, b: 24 };
  const max = Math.max(4, ...series.flatMap((s) => s.values));
  const raw = max / 4, p10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((x) => x >= raw && Number.isInteger(x * 4) && (x >= 1 ? Number.isInteger(x) : true)) ?? 10 * p10;
  const nice = Math.max(4, Math.ceil(step) * 4);
  const x = (i: number) => P.l + (i / Math.max(1, labels.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / nice) * (H - P.t - P.b);
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width * W - P.l) / ((W - P.l - P.r) / Math.max(1, labels.length - 1)));
    setHover(Math.max(0, Math.min(labels.length - 1, i)));
  };
  return (
    <div style={{ position: "relative" }}>
      <svg ref={svg} className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`${series[0]?.name} over time`}>
        <defs><linearGradient id="chartfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4f8cff" stopOpacity=".28" /><stop offset="1" stopColor="#4f8cff" stopOpacity="0" /></linearGradient></defs>
        {[0, .25, .5, .75, 1].map((f) => <g key={f}><line className="gridline" x1={P.l} x2={W - P.r} y1={y(nice * f)} y2={y(nice * f)} /><text className="axis" x={P.l - 6} y={y(nice * f) + 3} textAnchor="end">{Math.round(nice * f)}</text></g>)}
        {labels.map((l, i) => (labels.length <= 8 || i % Math.ceil(labels.length / 7) === 0) && <text key={i} className="axis" x={x(i)} y={H - 6} textAnchor="middle">{l}</text>)}
        {series.map((s, si) => {
          const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
          return <g key={si}>{si === 0 && <path className="area" d={`${d}L${x(s.values.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} />}<path className={`line ${s.dashed ? "b" : ""}`} d={d} vectorEffect="non-scaling-stroke" /></g>;
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="rgba(156,194,255,.35)" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover != null && (
        <div className="panel small" style={{ position: "absolute", top: 8, left: `clamp(8px, ${(x(hover) / W) * 100}% - 70px, calc(100% - 160px))`, padding: "8px 10px", pointerEvents: "none" }}>
          <div className="muted">{labels[hover]}</div>
          {series.map((s) => <div key={s.name}><b>{s.values[hover]?.toLocaleString("en")}</b> {s.name}</div>)}
        </div>
      )}
    </div>
  );
}

export function BarList({ items, empty = "No data yet" }: { items: { name: string; n: number }[]; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  if (!items.length) return <div className="muted small">{empty}</div>;
  return <div className="bars">{items.map((i) => <div key={i.name} className="bar-row"><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span><div className="track"><i style={{ width: `${(i.n / max) * 100}%` }} /></div><span className="muted" style={{ textAlign: "right" }}>{i.n.toLocaleString("en")}</span></div>)}</div>;
}

export function Pager({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (o: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1, pages = Math.ceil(total / limit);
  return (
    <div className="spread" style={{ padding: "12px 14px" }}>
      <span className="small muted">{offset + 1}–{Math.min(total, offset + limit)} of {total.toLocaleString("en")}</span>
      <div className="row"><Button size="sm" disabled={page <= 1} onClick={() => onChange(offset - limit)}>Previous</Button><span className="small">Page {page} of {pages}</span><Button size="sm" disabled={page >= pages} onClick={() => onChange(offset + limit)}>Next</Button></div>
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Drag-to-reorder for vertical lists (pointer + keyboard via the move buttons callers render). */
export function useReorder<T>(items: T[], onChange: (next: T[]) => void) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const bind = (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(i); },
    onDragEnd: () => { setDrag(null); setOver(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (drag == null || drag === i) return;
      const next = [...items];
      const [m] = next.splice(drag, 1);
      next.splice(i, 0, m);
      onChange(next);
      setDrag(null); setOver(null);
    },
    className: `list-item ${drag === i ? "dragging" : ""} ${over === i && drag !== i ? "over" : ""}`,
  });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return { bind, move };
}
