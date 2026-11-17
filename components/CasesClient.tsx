"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InvestigationCase } from "@/lib/types";
import { Empty, ICONS } from "./ui";

type CaseRow = InvestigationCase & { investigationCount: number };

const STATUS_COLOR: Record<string, string> = {
  open: "text-sky-300 bg-sky-500/10 ring-sky-500/20",
  in_progress: "text-amber-300 bg-amber-500/10 ring-amber-500/20",
  completed: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
  archived: "text-zinc-400 bg-zinc-500/10 ring-zinc-500/20",
};

export function CasesClient({ initial }: { initial: CaseRow[] }) {
  const router = useRouter();
  const [cases, setCases] = useState(initial);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [show, setShow] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description: desc }),
      });
      const data = await res.json();
      if (res.ok) {
        setCases((c) => [{ ...data.case, investigationCount: 0 }, ...c]);
        setTitle("");
        setDesc("");
        setShow(false);
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this case? Investigations inside it are kept.")) return;
    const res = await fetch(`/api/cases/${id}`, { method: "DELETE" });
    if (res.ok) setCases((c) => c.filter((x) => x.id !== id));
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShow((s) => !s)} className={show ? "btn" : "btn-primary"} aria-expanded={show}>
          <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform duration-300 ease-ios ${show ? "rotate-45" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New case
        </button>
      </div>

      {show && (
        <form onSubmit={create} className="panel mb-5 animate-pop space-y-4 p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold tracking-tight">Create a case</h2>
          <div>
            <label className="label">Title</label>
            <input className="input mt-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Acme Corp infrastructure review" autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input mt-2" rows={3} placeholder="Scope, objectives, authorization reference…" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={creating}>{creating && <span className="spinner" />}{creating ? "Creating…" : "Create case"}</button>
            <button type="button" className="btn" onClick={() => setShow(false)}>Cancel</button>
          </div>
        </form>
      )}

      {cases.length === 0 ? (
        <Empty icon={ICONS.folder} title="No cases yet" hint="Create one to organize investigations." />
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <div key={c.id} className="panel panel-hover flex flex-col p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <Link href={`/cases/${c.id}`} className="font-semibold tracking-tight transition-colors hover:text-accent-sky">{c.title}</Link>
                <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ${STATUS_COLOR[c.status]}`}>{c.status.replace("_", " ")}</span>
              </div>
              <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted">{c.description || "No description"}</p>
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-faint">
                <span className="tabular-nums">{c.investigationCount} investigations</span>
                <div className="flex items-center gap-1">
                  <Link href={`/cases/${c.id}`} className="btn-ghost !text-accent-sky">Open</Link>
                  <button onClick={() => del(c.id)} className="btn-danger">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
