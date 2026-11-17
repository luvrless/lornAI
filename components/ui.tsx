import type { RunState, SourceStatus } from "@/lib/types";

/* ------------------------------------------------------------------ brand */

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex flex-none items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: "linear-gradient(145deg, #7fa6ff 0%, #5b6cf5 50%, #8a5cf6 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -6px 12px rgba(40,20,120,0.35), 0 6px 20px -6px rgba(100,110,255,0.7)",
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none">
        <circle cx="11" cy="11" r="6" stroke="white" strokeWidth="2.4" />
        <path d="m15.5 15.5 4 4" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="11" cy="11" r="2" fill="white" />
      </svg>
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.25), transparent)" }}
      />
    </span>
  );
}

export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="text-[17px] font-semibold tracking-tight">
        lorn<span className="text-gradient">.lol</span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ icons */

export function Icon({ d, className = "h-[18px] w-[18px]", strokeWidth = 1.8 }: { d: string; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-4.3-4.3",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 18l-6-6 6-6",
  check: "M20 6 9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  copy: "M9 9h10v10H9zM5 15V5h10",
  key: "M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 1 15 7zm1.5 2.5h.01",
  shield: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  layers: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 18l10 5 10-5",
  graph: "M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 16l8-6M18 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-2 2-6-2",
  code: "M8 9l-4 3 4 3m8-6 4 3-4 3M14 5l-4 14",
  radar: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 12l6-6",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 1 1 8 0v3",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8",
  inbox: "M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  alert: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  logout: "M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
};

/* ----------------------------------------------------------------- layout */

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-gradient-soft text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  k,
  v,
  dot,
  className = "",
}: {
  k: React.ReactNode;
  v: string;
  dot?: string;
  className?: string;
}) {
  return (
    <div className={`panel panel-hover p-5 ${className}`}>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        {v}
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums">{k}</div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- status */

const STATE_STYLE: Record<RunState, { c: string; label: string }> = {
  waiting: { c: "text-faint bg-white/[0.04] ring-white/10", label: "Waiting" },
  running: { c: "text-accent-sky bg-accent-blue/10 ring-accent-blue/25", label: "Running" },
  completed: { c: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20", label: "Completed" },
  no_results: { c: "text-amber-300 bg-amber-500/10 ring-amber-500/20", label: "No results" },
  rate_limited: { c: "text-orange-300 bg-orange-500/10 ring-orange-500/20", label: "Rate limited" },
  auth_required: { c: "text-violet-300 bg-violet-500/10 ring-violet-500/20", label: "Needs key" },
  unavailable: { c: "text-zinc-400 bg-zinc-500/10 ring-zinc-500/20", label: "Unavailable" },
  failed: { c: "text-red-300 bg-red-500/10 ring-red-500/20", label: "Failed" },
};

export function StatePill({ state }: { state: RunState }) {
  const s = STATE_STYLE[state];
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 transition-colors duration-300 ${s.c}`}>
      {state === "running" ? (
        <span className="spinner !h-2.5 !w-2.5 !border-[1.5px]" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      )}
      {s.label}
    </span>
  );
}

const SOURCE_STATUS: Record<SourceStatus, { c: string; label: string }> = {
  integrated: { c: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20", label: "Live" },
  requires_key: { c: "text-violet-300 bg-violet-500/10 ring-violet-500/20", label: "Needs key" },
  public_web: { c: "text-sky-300 bg-sky-500/10 ring-sky-500/20", label: "Public web" },
  unavailable: { c: "text-zinc-400 bg-zinc-500/10 ring-zinc-500/20", label: "Unavailable" },
  planned: { c: "text-faint bg-white/5 ring-white/10", label: "Planned" },
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const s = SOURCE_STATUS[status];
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${s.c}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {s.label}
    </span>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8
      ? "from-emerald-400 to-emerald-300"
      : value >= 0.5
      ? "from-amber-400 to-amber-300"
      : "from-red-400 to-red-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-ios ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-faint">{pct}%</span>
    </div>
  );
}

/* ------------------------------------------------------------ empty/load */

export function Empty({
  title,
  hint,
  icon = ICONS.inbox,
  action,
}: {
  title: string;
  hint?: React.ReactNode;
  icon?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel flex animate-rise flex-col items-center justify-center px-6 py-16 text-center">
      <div className="icon-tile mb-4 h-12 w-12">
        <Icon d={icon} className="h-5 w-5" />
      </div>
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-11" style={{ opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  );
}
