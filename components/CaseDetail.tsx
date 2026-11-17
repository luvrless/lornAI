"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InvestigationCase, CaseStatus } from "@/lib/types";

type InvSummary = { id: string; input: string; identifierType: string; createdAt: string; stats: { uniqueFindings: number } };
const STATUSES: CaseStatus[] = ["open", "in_progress", "completed", "archived"];

export function CaseDetail({ initial, investigations }: { initial: InvestigationCase; investigations: InvSummary[] }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [note, setNote] = useState("");

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/cases/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok && data.case) setC(data.case);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/cases" className="btn-ghost mb-5 !px-2.5 !text-sm">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        All cases
      </Link>
      <div className="panel mb-5 animate-rise p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow mb-2">Case</div>
            <h1 className="text-gradient-soft text-[28px] font-semibold leading-tight tracking-tight">{c.title}</h1>
            <p className="mt-2 text-muted">{c.description || "No description"}</p>
          </div>
          <select
            value={c.status}
            onChange={(e) => patch({ status: e.target.value as CaseStatus })}
            className="input !w-auto capitalize"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-4 text-xs text-faint">
          <span>Created {new Date(c.createdAt).toLocaleString()}</span>
          <span>·</span>
          <span>Updated {new Date(c.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="panel animate-rise p-5 sm:p-6" style={{ animationDelay: "80ms" }}>
          <h2 className="mb-4 text-[15px] font-semibold tracking-tight">Investigations <span className="text-faint">({investigations.length})</span></h2>
          {investigations.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">
              No investigations attached. Run one and save it to this case from the <Link href="/investigate" className="link">Investigate</Link> page.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {investigations.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="mono truncate text-sm">{i.input}</div>
                    <div className="text-xs text-faint">{i.identifierType} · {i.stats.uniqueFindings} findings</div>
                  </div>
                  <button onClick={() => patch({ detachInvestigation: i.id })} className="btn-danger flex-none">Detach</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel animate-rise p-5 sm:p-6" style={{ animationDelay: "140ms" }}>
          <h2 className="mb-4 text-[15px] font-semibold tracking-tight">Notes</h2>
          <div className="space-y-2">
            {c.notes.length === 0 && <p className="text-sm text-faint">No notes yet.</p>}
            {c.notes.map((n) => (
              <div key={n.id} className="tile animate-pop p-3 text-sm">
                <p className="whitespace-pre-wrap leading-relaxed">{n.body}</p>
                <div className="mt-1 text-[11px] text-faint">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (note.trim()) { patch({ addNote: note }); setNote(""); } }}
            className="mt-4 space-y-2"
          >
            <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
            <button className="btn-primary w-full">Add note</button>
          </form>
        </div>
      </div>
    </div>
  );
}
