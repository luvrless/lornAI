"use client";
import { useState } from "react";
import type { Investigation, IdentifierType } from "@/lib/types";
import { Empty, ICONS, SkeletonRows, StatePill } from "./ui";

type Row = {
  id: string;
  input: string;
  normalized: string;
  identifierType: IdentifierType;
  createdAt: string;
  stats: { attempted: number; completed: number; uniqueFindings: number; failed: number };
};

export function InvestigationsList({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle(id: string) {
    if (open === id) { setOpen(null); setDetail(null); return; }
    setOpen(id);
    setDetail(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/investigations/${id}`);
      const data = await res.json();
      if (res.ok) setDetail(data.investigation);
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this investigation permanently?")) return;
    const res = await fetch(`/api/investigations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((r) => r.filter((x) => x.id !== id));
      if (open === id) { setOpen(null); setDetail(null); }
    }
  }

  if (rows.length === 0)
    return <Empty icon={ICONS.search} title="No saved investigations yet." hint="Run an investigation and save it to see it here." />;

  return (
    <div className="stagger space-y-2.5">
      {rows.map((r) => (
        <div key={r.id} id={r.id} className={`panel scroll-mt-24 overflow-hidden ${open === r.id ? "!border-accent-blue/25" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3.5">
            <button onClick={() => toggle(r.id)} className="group flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open === r.id}>
              <svg viewBox="0 0 24 24" className={`h-4 w-4 flex-none text-faint transition-transform duration-300 ease-ios group-hover:text-white ${open === r.id ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
              <span className="chip flex-none !py-0.5 text-[11px]">{r.identifierType}</span>
              <span className="mono truncate text-sm transition-colors group-hover:text-accent-sky">{r.normalized}</span>
            </button>
            <div className="flex flex-none items-center gap-1 text-xs text-faint">
              <span className="mr-2 hidden tabular-nums md:inline">{new Date(r.createdAt).toLocaleString()}</span>
              <span className="mr-1 tabular-nums">{r.stats.uniqueFindings} findings</span>
              <a href={`/api/investigations/${r.id}/export?format=json`} className="btn-ghost">JSON</a>
              <a href={`/api/investigations/${r.id}/export?format=csv`} className="btn-ghost">CSV</a>
              <button onClick={() => del(r.id)} className="btn-danger">Delete</button>
            </div>
          </div>
          {open === r.id && (
            <div className="animate-pop border-t border-white/[0.06] p-4">
              {loading && <SkeletonRows rows={3} />}
              {detail && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <Mini k={detail.stats.attempted} v="Sources" />
                    <Mini k={detail.stats.completed} v="With data" />
                    <Mini k={detail.stats.uniqueFindings} v="Unique" />
                    <Mini k={detail.durationMs ? `${detail.durationMs}ms` : "—"} v="Duration" />
                  </div>
                  <div className="space-y-1.5">
                    {detail.results.map((res) => (
                      <div key={res.sourceId} className="tile p-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{res.sourceId}</span>
                          <StatePill state={res.state} />
                        </div>
                        <div className="space-y-1">
                          {res.findings.slice(0, 8).map((f, i) => (
                            <div key={i} className="flex justify-between gap-2 text-xs">
                              <span className="text-faint">{f.label}</span>
                              <span className="mono truncate">{f.sensitive ? "•••" : f.value}</span>
                            </div>
                          ))}
                          {res.findings.length > 8 && <div className="text-xs text-faint">+{res.findings.length - 8} more</div>}
                          {res.findings.length === 0 && <div className="text-xs text-faint">{res.message || "no findings"}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Mini({ k, v }: { k: number | string; v: string }) {
  return (
    <div className="tile p-3">
      <div className="text-lg font-semibold tabular-nums">{k}</div>
      <div className="text-[11px] text-faint">{v}</div>
    </div>
  );
}
