"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { readSSE } from "@/lib/sse";
import { StatePill, ConfidenceBar } from "./ui";
import type {
  Finding,
  Investigation,
  RunState,
  SourceMeta,
  SourceResult,
  IdentifierType,
} from "@/lib/types";

type SrcRow = { id: string; name: string; meta?: SourceMeta; state: RunState; result?: SourceResult };

function guessType(v: string): string {
  const s = v.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return "url";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "email";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return "ip";
  if (/^0x[a-fA-F0-9]{40}$/.test(s) || /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/.test(s)) return "wallet";
  if (/^[a-f0-9]{32}$/i.test(s) || /^[a-f0-9]{40}$/i.test(s) || /^[a-f0-9]{64}$/i.test(s)) return "hash";
  if (/^[+(]?\d[\d\s().-]{6,}$/.test(s)) return "phone";
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s)) return "domain";
  if (/^@?[a-z0-9._-]{2,40}$/i.test(s)) return "username";
  return "organization";
}

const EXAMPLES = ["example.com", "8.8.8.8", "octocat", "security@github.com", "+14155552671"];

export function Investigate({ cases }: { cases: { id: string; title: string }[] }) {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [detected, setDetected] = useState<{ identifierType: IdentifierType; normalized: string; note?: string } | null>(null);
  const [rows, setRows] = useState<SrcRow[]>([]);
  const [skipped, setSkipped] = useState<{ id: string; name: string; status: string; category: string }[]>([]);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [tab, setTab] = useState("overview");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedCase, setSelectedCase] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const liveType = useMemo(() => guessType(input), [input]);

  async function start(value?: string) {
    const q = (value ?? input).trim();
    if (!q || running) return;
    setInput(q);
    setRunning(true);
    setDetected(null);
    setRows([]);
    setSkipped([]);
    setInvestigation(null);
    setSavedId(null);
    setTab("overview");
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: q }),
        signal: ac.signal,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      await readSSE(res, (event, data) => {
        const d = data as Record<string, unknown>;
        if (event === "detected") {
          setDetected({ identifierType: d.identifierType as IdentifierType, normalized: d.normalized as string, note: d.note as string });
        } else if (event === "plan") {
          const sources = d.sources as { id: string; name: string; meta?: SourceMeta }[];
          setRows(sources.map((s) => ({ id: s.id, name: s.name, meta: s.meta, state: "waiting" as RunState })));
        } else if (event === "skipped") {
          setSkipped((d.planned as typeof skipped) || []);
        } else if (event === "source_start") {
          setRows((r) => r.map((x) => (x.id === d.id ? { ...x, state: "running" } : x)));
        } else if (event === "source_done") {
          const result = d.result as SourceResult;
          setRows((r) => r.map((x) => (x.id === result.sourceId ? { ...x, state: result.state, result } : x)));
        } else if (event === "complete") {
          setInvestigation(d.investigation as Investigation);
        } else if (event === "error") {
          console.error("investigation error", d.message);
        }
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error(e);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setRunning(false);
  }

  async function save() {
    if (!investigation || savedId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/investigations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ investigation, caseId: selectedCase || undefined }),
      });
      const data = await res.json();
      if (res.ok) setSavedId(data.id);
    } finally {
      setSaving(false);
    }
  }

  function exportLocal(format: "json" | "csv") {
    if (!investigation) return;
    const blob = buildExport(investigation, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lorn-${investigation.normalized}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const started = rows.length > 0 || running || detected;
  const progress = rows.length ? rows.filter((r) => r.state !== "waiting" && r.state !== "running").length / rows.length : 0;

  return (
    <div>
      {/* Search bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); start(); }}
        className="panel p-2 shadow-lift"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="searchbar flex-1 py-3.5">
            <svg className={`h-5 w-5 flex-none transition-colors ${input ? "text-accent-sky" : "text-faint"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter an email, phone, username, domain, IP, URL, hash or wallet…"
              className="mono min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
              autoFocus
            />
            {liveType && !running && (
              <span key={liveType} className="chip flex-none animate-pop !border-accent-blue/30 !bg-accent-blue/10 !py-0.5 text-[11px] !text-accent-sky">{liveType}</span>
            )}
          </div>
          {running ? (
            <button type="button" onClick={cancel} className="btn flex-none !px-5 !py-3">
              <span className="spinner" />
              Cancel
            </button>
          ) : (
            <button type="submit" className="btn-primary flex-none !px-6 !py-3" disabled={!input.trim()}>
              Investigate
            </button>
          )}
        </div>
      </form>

      {!started && (
        <div className="mt-5 flex animate-rise flex-wrap items-center gap-2 text-sm text-muted">
          <span className="label mr-1">Try</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => start(ex)} className="chip mono hover:!border-accent-blue/35 hover:!bg-accent-blue/10 hover:!text-white">
              {ex}
            </button>
          ))}
        </div>
      )}

      {started && (
        <div className="mt-5 grid animate-rise gap-5 lg:grid-cols-[320px_1fr]">
          {/* Left: source rail */}
          <div className="space-y-3">
            <div className="panel p-5">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="label">Detected</span>
                {detected && <span className="chip animate-pop !border-accent-blue/30 !bg-accent-blue/10 !py-0.5 !text-accent-sky">{detected.identifierType}{detected.note ? ` · ${detected.note}` : ""}</span>}
              </div>
              <div className="mono break-all text-[15px] text-white">{detected?.normalized || input}</div>
              {rows.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs tabular-nums text-faint">
                    <span>{rows.filter((r) => r.state !== "waiting" && r.state !== "running").length}/{rows.length} sources</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-accent-blue to-accent-violet shadow-[0_0_12px_rgba(110,120,255,0.7)] transition-[width] duration-500 ease-ios" style={{ width: `${progress * 100}%` }}>
                      {running && <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="panel max-h-[560px] divide-y divide-white/[0.05] overflow-y-auto">
              {rows.map((r) => (
                <div key={r.id} className={`flex items-center justify-between gap-2 px-4 py-2.5 transition-colors duration-300 ${r.state === "running" ? "bg-accent-blue/[0.04]" : ""}`}>
                  <div className="min-w-0">
                    <div className="truncate text-sm">{r.name}</div>
                    <div className="truncate text-[11px] text-faint">
                      {r.result?.message || r.meta?.category || ""}
                      {r.result?.durationMs ? ` · ${r.result.durationMs}ms` : ""}
                    </div>
                  </div>
                  <StatePill state={r.state} />
                </div>
              ))}
              {rows.length === 0 && running && (
                <div className="flex items-center justify-center gap-2 px-3.5 py-8 text-sm text-faint"><span className="spinner" />Planning sources…</div>
              )}
              {rows.length === 0 && !running && (
                <div className="px-4 py-8 text-center text-sm text-faint">
                  No live adapters support this identifier type. See key-ready sources below.
                </div>
              )}
            </div>

            {skipped.length > 0 && (
              <div className="panel p-5">
                <div className="label mb-2">Key-ready sources ({skipped.length})</div>
                <p className="mb-2 text-xs text-faint">Registered and ready to run once credentials are configured.</p>
                <div className="flex flex-wrap gap-1.5">
                  {skipped.slice(0, 24).map((s) => (
                    <span key={s.id} className="chip !py-0.5 text-[11px]" title={s.status}>{s.name}</span>
                  ))}
                  {skipped.length > 24 && <span className="chip !py-0.5 text-[11px]">+{skipped.length - 24} more</span>}
                </div>
              </div>
            )}
          </div>

          {/* Right: results */}
          <div className="space-y-4">
            {investigation && (
              <div className="flex animate-pop flex-wrap items-center gap-2">
                {savedId ? (
                  <span className="chip animate-pop !border-emerald-500/25 !bg-emerald-500/10 !py-1.5 !text-emerald-300">Saved ✓</span>
                ) : (
                  <>
                    {cases.length > 0 && (
                      <select value={selectedCase} onChange={(e) => setSelectedCase(e.target.value)} className="input !w-auto !py-2 text-sm">
                        <option value="">No case</option>
                        {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    )}
                    <button onClick={save} className="btn-primary" disabled={saving}>
                      {saving && <span className="spinner" />}
                      {saving ? "Saving…" : "Save investigation"}
                    </button>
                  </>
                )}
                <button onClick={() => exportLocal("json")} className="btn">Export JSON</button>
                <button onClick={() => exportLocal("csv")} className="btn">Export CSV</button>
                {savedId && <Link href="/graph" className="btn">Open in graph</Link>}
              </div>
            )}

            <ResultsView rows={rows} investigation={investigation} running={running} tab={tab} setTab={setTab} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Results rendering ----

function ResultsView({
  rows,
  investigation,
  running,
  tab,
  setTab,
}: {
  rows: SrcRow[];
  investigation: Investigation | null;
  running: boolean;
  tab: string;
  setTab: (t: string) => void;
}) {
  const findings = useMemo(() => rows.flatMap((r) => r.result?.findings || []), [rows]);
  const byCat = useMemo(() => {
    const map: Record<string, { finding: Finding; source: string }[]> = {};
    for (const r of rows) {
      const cat = r.meta?.category || "other";
      for (const f of r.result?.findings || []) {
        (map[cat] ||= []).push({ finding: f, source: r.name });
      }
    }
    return map;
  }, [rows]);

  const stats = investigation?.stats;
  const completedRows = rows.filter((r) => r.state === "completed");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "findings", label: `All findings${findings.length ? ` (${findings.length})` : ""}` },
    { id: "sources", label: `Sources (${rows.length})` },
    { id: "raw", label: "Raw" },
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-white/[0.06] p-2">
        <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-black/25 p-1 ring-1 ring-white/[0.05]" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all duration-300 ease-ios ${
              tab === t.id
                ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
        </div>
      </div>

      <div key={tab} className="animate-fadein p-4 sm:p-5">
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat k={stats?.attempted ?? rows.length} v="Sources run" />
              <Stat k={stats?.completed ?? completedRows.length} v="With data" accent="emerald" />
              <Stat k={stats?.uniqueFindings ?? findings.length} v="Unique findings" accent="blue" />
              <Stat k={stats?.failed ?? rows.filter((r) => ["failed", "unavailable", "rate_limited", "auth_required"].includes(r.state)).length} v="Failed / skipped" accent="amber" />
            </div>
            {running && <p className="flex items-center gap-2 text-sm text-muted"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-sky opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent-sky" /></span>Live — sources are still reporting…</p>}
            {!running && investigation && (
              <p className="text-sm text-muted">
                Completed in {investigation.durationMs}ms. {stats?.completed} of {stats?.attempted} sources returned data.
              </p>
            )}
            {/* category highlights */}
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(byCat).map(([cat, items]) => (
                <div key={cat} className="tile animate-pop p-4">
                  <div className="label mb-2">{cat.replace(/_/g, " ")}</div>
                  <ul className="space-y-1">
                    {items.slice(0, 4).map((it, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-faint">{it.finding.label}</span>
                        <span className="mono min-w-0 truncate text-right">{it.finding.sensitive ? "•••••" : it.finding.value}</span>
                      </li>
                    ))}
                    {items.length > 4 && <li className="text-xs text-faint">+{items.length - 4} more</li>}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "findings" && (
          <div className="space-y-1.5">
            {findings.length === 0 && <p className="py-10 text-center text-sm text-faint">{running ? "Waiting for findings…" : "No findings yet."}</p>}
            {findings.map((f, i) => <FindingRow key={i} f={f} />)}
          </div>
        )}

        {tab === "sources" && (
          <div className="space-y-2">
            {rows.map((r) => <SourceResultCard key={r.id} row={r} />)}
          </div>
        )}

        {tab === "raw" && (
          <pre className="codeblock max-h-[600px]">
            {JSON.stringify(investigation ?? { partial: rows.map((r) => r.result).filter(Boolean) }, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function Stat({ k, v, accent }: { k: number | string; v: string; accent?: string }) {
  const c = accent === "emerald" ? "text-emerald-300" : accent === "blue" ? "text-accent-sky" : accent === "amber" ? "text-amber-300" : "";
  return (
    <div className="tile p-4">
      <div className={`text-[26px] font-semibold leading-none tracking-tight tabular-nums ${c}`}>{k}</div>
      <div className="mt-2 text-xs text-faint">{v}</div>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="tile flex items-start justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="label">{f.label}</div>
        <div className="mono mt-1 break-all text-sm">
          {f.sensitive && !reveal ? (
            <button onClick={() => setReveal(true)} className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-300 ring-1 ring-violet-500/20 transition hover:bg-violet-500/20">reveal sensitive ••</button>
          ) : (
            f.value
          )}
        </div>
        {f.sourceUrl && (
          <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="link mt-0.5 block truncate text-xs">{f.sourceUrl}</a>
        )}
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        <ConfidenceBar value={f.confidence} />
        <span className="chip !px-1.5 !py-0 text-[10px]">{f.sourceId}</span>
      </div>
    </div>
  );
}

function SourceResultCard({ row }: { row: SrcRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`tile overflow-hidden ${open ? "!border-white/10" : ""}`}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="flex min-w-0 items-center gap-2.5">
          <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 flex-none text-faint transition-transform duration-300 ease-ios ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          <div className="min-w-0">
          <div className="text-sm font-medium">{row.name}</div>
          <div className="text-[11px] text-faint">
            {row.meta?.category} · {row.result?.findings.length ?? 0} findings
            {row.result?.message ? ` · ${row.result.message}` : ""}
          </div>
          </div>
        </div>
        <StatePill state={row.state} />
      </button>
      {open && row.result && (
        <div className="animate-pop space-y-1.5 border-t border-white/[0.06] p-3">
          {row.result.findings.map((f, i) => <FindingRow key={i} f={f} />)}
          {row.result.raw != null && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-faint transition-colors hover:text-white">▸ Raw response</summary>
              <pre className="codeblock mt-2 max-h-72 !p-3 !text-[11px]">
                {JSON.stringify(row.result.raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function buildExport(inv: Investigation, format: "json" | "csv"): Blob {
  if (format === "json") {
    return new Blob([JSON.stringify(inv, null, 2)], { type: "application/json" });
  }
  const rows: string[] = ["source,state,key,label,value,confidence,source_url"];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  for (const r of inv.results) {
    for (const f of r.findings) {
      rows.push([r.sourceId, r.state, f.key, f.label, f.sensitive ? "[redacted]" : f.value, f.confidence.toFixed(2), f.sourceUrl || ""].map(esc).join(","));
    }
  }
  return new Blob([rows.join("\n")], { type: "text/csv" });
}
