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
      <Link href="/cases" className="link mb-4 inline-block text-sm">← All cases</Link>
      <div className="panel mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{c.title}</h1>
            <p className="mt-1 text-muted">{c.description || "No description"}</p>
          </div>
          <select
            value={c.status}
            onChange={(e) => patch({ status: e.target.value as CaseStatus })}
            className="input !w-auto"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-faint">
          <span>Created {new Date(c.createdAt).toLocaleString()}</span>
          <span>·</span>
          <span>Updated {new Date(c.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="panel p-5">
          <h2 className="mb-3 font-medium">Investigations ({investigations.length})</h2>
          {investigations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No investigations attached. Run one and save it to this case from the <Link href="/investigate" className="link">Investigate</Link> page.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {investigations.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="mono truncate text-sm">{i.input}</div>
                    <div className="text-xs text-faint">{i.identifierType} · {i.stats.uniqueFindings} findings</div>
                  </div>
                  <button onClick={() => patch({ detachInvestigation: i.id })} className="text-xs text-red-300 hover:underline">Detach</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-5">
          <h2 className="mb-3 font-medium">Notes</h2>
          <div className="space-y-2">
            {c.notes.length === 0 && <p className="text-sm text-faint">No notes yet.</p>}
            {c.notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-sm">
                <p>{n.body}</p>
                <div className="mt-1 text-[11px] text-faint">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (note.trim()) { patch({ addNote: note }); setNote(""); } }}
            className="mt-3 space-y-2"
          >
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
            <button className="btn-primary w-full !py-1.5">Add note</button>
          </form>
        </div>
      </div>
    </div>
  );
}
