"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InvestigationCase } from "@/lib/types";

type CaseRow = InvestigationCase & { investigationCount: number };

const STATUS_COLOR: Record<string, string> = {
  open: "text-sky-300 bg-sky-500/10",
  in_progress: "text-amber-300 bg-amber-500/10",
  completed: "text-emerald-300 bg-emerald-500/10",
  archived: "text-zinc-400 bg-zinc-500/10",
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
        <button onClick={() => setShow((s) => !s)} className="btn-primary">New case</button>
      </div>

      {show && (
        <form onSubmit={create} className="panel mb-4 space-y-3 p-4">
          <div>
            <label className="label">Title</label>
            <input className="input mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Acme Corp infrastructure review" autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input mt-1.5" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={creating}>{creating ? "Creating…" : "Create case"}</button>
            <button type="button" className="btn" onClick={() => setShow(false)}>Cancel</button>
          </div>
        </form>
      )}

      {cases.length === 0 ? (
        <div className="panel px-6 py-16 text-center text-muted">No cases yet. Create one to organize investigations.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <div key={c.id} className="panel flex flex-col p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <Link href={`/cases/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_COLOR[c.status]}`}>{c.status.replace("_", " ")}</span>
              </div>
              <p className="flex-1 text-sm text-muted line-clamp-2">{c.description || "No description"}</p>
              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-xs text-faint">
                <span>{c.investigationCount} investigations</span>
                <div className="flex gap-2">
                  <Link href={`/cases/${c.id}`} className="link">Open</Link>
                  <button onClick={() => del(c.id)} className="text-red-300 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
