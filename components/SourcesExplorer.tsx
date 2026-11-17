"use client";
import { useMemo, useState } from "react";
import type { SourceMeta, SourceStatus } from "@/lib/types";
import { Empty, ICONS, SourceStatusBadge } from "./ui";

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
      <div className="panel sticky top-[64px] z-20 mb-4 flex flex-col gap-3 p-3 lg:top-4 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sources…"
            className="input !pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-full bg-black/20 p-1 ring-1 ring-white/[0.05]">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatus(f.id)}
              aria-pressed={status === f.id}
              className={`chip !border-transparent !bg-transparent hover:!text-white ${status === f.id ? "chip-active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="input capitalize lg:ml-auto lg:!w-auto">
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All categories" : c.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <div className="mb-3 text-sm text-faint"><span className="tabular-nums">{filtered.length}</span> sources</div>

      {filtered.length === 0 && <Empty icon={ICONS.search} title="No sources match" hint="Try a different search term or filter." />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <div key={s.id} className="panel panel-hover flex flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold tracking-tight">{s.name}</div>
                <div className="label mt-0.5">{s.category.replace(/_/g, " ")}</div>
              </div>
              <SourceStatusBadge status={s.status} />
            </div>
            <p className="flex-1 break-words text-sm leading-relaxed text-muted">{s.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {s.supports.map((t) => (
                <span key={t} className="chip !px-1.5 !py-0 text-[10px]">{t}</span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-faint">
              <span>{s.authRequired ? "API key required" : "No key required"}</span>
              {s.docsUrl && <a href={s.docsUrl} target="_blank" rel="noreferrer" className="btn-ghost !text-accent-sky">Docs ↗</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
