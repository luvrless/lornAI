"use client";
import { useMemo, useState } from "react";
import type { SourceMeta, SourceStatus } from "@/lib/types";
import { SourceStatusBadge } from "./ui";

const STATUS_FILTERS: { id: SourceStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "integrated", label: "Live" },
  { id: "requires_key", label: "Needs key" },
  { id: "public_web", label: "Public web" },
  { id: "planned", label: "Planned" },
];

export function SourcesExplorer({ sources }: { sources: SourceMeta[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<SourceStatus | "all">("all");
  const [cat, setCat] = useState<string>("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(sources.map((s) => s.category))).sort()],
    [sources]
  );

  const filtered = useMemo(
    () =>
      sources.filter(
        (s) =>
          (status === "all" || s.status === status) &&
          (cat === "all" || s.category === cat) &&
          (!q ||
            s.name.toLowerCase().includes(q.toLowerCase()) ||
            s.description.toLowerCase().includes(q.toLowerCase()))
      ),
    [sources, q, status, cat]
  );

  return (
    <div>
      <div className="panel mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sources…"
          className="input sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatus(f.id)}
              className={`chip ${status === f.id ? "!border-accent-blue/40 !text-white" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="input !w-auto sm:ml-auto">
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All categories" : c.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <div className="mb-3 text-sm text-faint">{filtered.length} sources</div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <div key={s.id} className="panel flex flex-col p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-[11px] uppercase tracking-wide text-faint">{s.category.replace(/_/g, " ")}</div>
              </div>
              <SourceStatusBadge status={s.status} />
            </div>
            <p className="flex-1 text-sm text-muted">{s.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {s.supports.map((t) => (
                <span key={t} className="chip !px-1.5 !py-0 text-[10px]">{t}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-xs text-faint">
              <span>{s.authRequired ? "API key required" : "No key required"}</span>
              {s.docsUrl && <a href={s.docsUrl} target="_blank" rel="noreferrer" className="link">Docs</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
