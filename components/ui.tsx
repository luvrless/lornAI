import type { RunState, SourceStatus } from "@/lib/types";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

const STATE_STYLE: Record<RunState, { c: string; label: string }> = {
  waiting: { c: "text-faint bg-white/5", label: "Waiting" },
  running: { c: "text-accent-sky bg-accent-blue/10", label: "Running" },
  completed: { c: "text-emerald-300 bg-emerald-500/10", label: "Completed" },
  no_results: { c: "text-amber-300 bg-amber-500/10", label: "No results" },
  rate_limited: { c: "text-orange-300 bg-orange-500/10", label: "Rate limited" },
  auth_required: { c: "text-violet-300 bg-violet-500/10", label: "Needs key" },
  unavailable: { c: "text-zinc-400 bg-zinc-500/10", label: "Unavailable" },
  failed: { c: "text-red-300 bg-red-500/10", label: "Failed" },
};

export function StatePill({ state }: { state: RunState }) {
  const s = STATE_STYLE[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.c}`}>
      {state === "running" && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulseglow" />}
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
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${s.c}`}>
      {s.label}
    </span>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? "bg-emerald-400" : value >= 0.5 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-faint">{pct}%</span>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 h-10 w-10 rounded-xl bg-white/5 ring-1 ring-white/10" />
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  );
}
