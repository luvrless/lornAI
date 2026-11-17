"use client";
import { useState } from "react";
import type { Investigation, IdentifierType } from "@/lib/types";
import { StatePill } from "./ui";

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
    return <div className="panel px-6 py-16 text-center text-muted">No saved investigations yet.</div>;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} id={r.id} className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <button onClick={() => toggle(r.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="chip !py-0.5 text-[11px]">{r.identifierType}</span>
              <span className="mono truncate text-sm">{r.normalized}</span>
            </button>
            <div className="flex flex-none items-center gap-3 text-xs text-faint">
              <span className="hidden sm:inline">{new Date(r.createdAt).toLocaleString()}</span>
              <span>{r.stats.uniqueFindings} findings</span>
              <a href={`/api/investigations/${r.id}/export?format=json`} className="link">JSON</a>
              <a href={`/api/investigations/${r.id}/export?format=csv`} className="link">CSV</a>
              <button onClick={() => del(r.id)} className="text-red-300 hover:underline">Delete</button>
            </div>
          </div>
          {open === r.id && (
            <div className="border-t border-white/5 p-4">
              {loading && <p className="text-sm text-faint">Loading…</p>}
              {detail && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-4">
                    <Mini k={detail.stats.attempted} v="Sources" />
                    <Mini k={detail.stats.completed} v="With data" />
                    <Mini k={detail.stats.uniqueFindings} v="Unique" />
                    <Mini k={detail.durationMs ? `${detail.durationMs}ms` : "—"} v="Duration" />
                  </div>
                  <div className="space-y-1.5">
                    {detail.results.map((res) => (
                      <div key={res.sourceId} className="rounded-lg border border-white/5 bg-white/[0.015] p-2.5">
                        <div className="mb-1 flex items-center justify-between">
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
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
      <div className="text-lg font-semibold">{k}</div>
      <div className="text-[11px] text-faint">{v}</div>
    </div>
  );
}
