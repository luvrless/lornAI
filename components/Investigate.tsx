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
        className="panel p-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-3 rounded-lg bg-ink-950/70 px-4 py-3">
            <svg className="h-5 w-5 flex-none text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter an email, phone, username, domain, IP, URL, hash or wallet…"
              className="mono flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
              autoFocus
            />
            {liveType && !running && (
              <span className="chip flex-none !py-0.5 text-[11px]">{liveType}</span>
            )}
          </div>
          {running ? (
            <button type="button" onClick={cancel} className="btn flex-none">Cancel</button>
          ) : (
            <button type="submit" className="btn-primary flex-none" disabled={!input.trim()}>
              Investigate
            </button>
          )}
        </div>
      </form>

      {!started && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="text-faint">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => start(ex)} className="chip hover:border-white/20 hover:text-white">
              {ex}
            </button>
          ))}
        </div>
      )}

      {started && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Left: source rail */}
          <div className="space-y-3">
            <div className="panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="label">Detected</span>
                {detected && <span className="chip !py-0.5">{detected.identifierType}{detected.note ? ` · ${detected.note}` : ""}</span>}
              </div>
              <div className="mono break-all text-sm">{detected?.normalized || input}</div>
              {rows.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-faint">
                    <span>{rows.filter((r) => r.state !== "waiting" && r.state !== "running").length}/{rows.length} sources</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-gradient-to-r from-accent-blue to-accent-violet transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="panel divide-y divide-white/5 overflow-hidden">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
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
                <div className="px-3.5 py-6 text-center text-sm text-faint">Planning sources…</div>
              )}
              {rows.length === 0 && !running && (
                <div className="px-3.5 py-6 text-center text-sm text-faint">
                  No live adapters support this identifier type. See key-ready sources below.
                </div>
              )}
            </div>

            {skipped.length > 0 && (
              <div className="panel p-4">
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
              <div className="flex flex-wrap items-center gap-2">
                {savedId ? (
                  <span className="chip text-emerald-300">Saved ✓</span>
                ) : (
                  <>
                    {cases.length > 0 && (
                      <select value={selectedCase} onChange={(e) => setSelectedCase(e.target.value)} className="input !w-auto !py-1.5 text-sm">
                        <option value="">No case</option>
                        {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    )}
                    <button onClick={save} className="btn-primary !py-1.5" disabled={saving}>
                      {saving ? "Saving…" : "Save investigation"}
                    </button>
                  </>
                )}
                <button onClick={() => exportLocal("json")} className="btn !py-1.5">Export JSON</button>
                <button onClick={() => exportLocal("csv")} className="btn !py-1.5">Export CSV</button>
                {savedId && <Link href="/graph" className="btn !py-1.5">Open in graph</Link>}
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
      <div className="flex gap-1 overflow-x-auto border-b border-white/5 px-2 pt-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-t-lg px-3.5 py-2 text-sm transition ${
              tab === t.id ? "bg-white/5 text-white" : "text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat k={stats?.attempted ?? rows.length} v="Sources run" />
              <Stat k={stats?.completed ?? completedRows.length} v="With data" accent="emerald" />
              <Stat k={stats?.uniqueFindings ?? findings.length} v="Unique findings" accent="blue" />
              <Stat k={stats?.failed ?? rows.filter((r) => ["failed", "unavailable", "rate_limited", "auth_required"].includes(r.state)).length} v="Failed / skipped" accent="amber" />
            </div>
            {running && <p className="text-sm text-muted">Live — sources are still reporting…</p>}
            {!running && investigation && (
              <p className="text-sm text-muted">
                Completed in {investigation.durationMs}ms. {stats?.completed} of {stats?.attempted} sources returned data.
              </p>
            )}
            {/* category highlights */}
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(byCat).map(([cat, items]) => (
                <div key={cat} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="label mb-2">{cat.replace(/_/g, " ")}</div>
                  <ul className="space-y-1">
                    {items.slice(0, 4).map((it, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-faint">{it.finding.label}</span>
                        <span className="mono truncate text-right">{it.finding.sensitive ? "•••••" : it.finding.value}</span>
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
            {findings.length === 0 && <p className="py-6 text-center text-sm text-faint">No findings yet.</p>}
            {findings.map((f, i) => <FindingRow key={i} f={f} />)}
          </div>
        )}

        {tab === "sources" && (
          <div className="space-y-2">
            {rows.map((r) => <SourceResultCard key={r.id} row={r} />)}
          </div>
        )}

        {tab === "raw" && (
          <pre className="mono max-h-[600px] overflow-auto rounded-lg bg-ink-950/70 p-3 text-xs text-muted">
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
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className={`text-2xl font-semibold ${c}`}>{k}</div>
      <div className="mt-0.5 text-xs text-faint">{v}</div>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.015] px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-faint">{f.label}</div>
        <div className="mono mt-0.5 break-all text-sm">
          {f.sensitive && !reveal ? (
            <button onClick={() => setReveal(true)} className="text-violet-300 hover:underline">reveal sensitive ••</button>
          ) : (
            f.value
          )}
        </div>
        {f.sourceUrl && (
          <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="link text-xs">{f.sourceUrl}</a>
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
    <div className="rounded-lg border border-white/5 bg-white/[0.015]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left">
        <div className="min-w-0">
          <div className="text-sm font-medium">{row.name}</div>
          <div className="text-[11px] text-faint">
            {row.meta?.category} · {row.result?.findings.length ?? 0} findings
            {row.result?.message ? ` · ${row.result.message}` : ""}
          </div>
        </div>
        <StatePill state={row.state} />
      </button>
      {open && row.result && (
        <div className="space-y-1.5 border-t border-white/5 p-3">
          {row.result.findings.map((f, i) => <FindingRow key={i} f={f} />)}
          {row.result.raw != null && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-faint">Raw response</summary>
              <pre className="mono mt-1 max-h-72 overflow-auto rounded bg-ink-950/70 p-2 text-[11px] text-muted">
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
