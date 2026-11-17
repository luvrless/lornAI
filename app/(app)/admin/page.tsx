import { redirect } from "next/navigation";
import { getCurrentUser, hasRole, publicUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { registryStats } from "@/lib/sources/registry";
import { PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { AdminClient } from "@/components/AdminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function AdminPage() {
  const session = getCurrentUser()!;
  if (!hasRole(session.user, "admin")) redirect("/overview");

  const users = db.all("users").map(publicUser);
  const investigations = db.all("investigations");
  const cases = db.all("cases");
  const keys = db.filter("apikeys", (k) => !k.revoked);
  const audit = [...db.all("audit")].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);
  const reg = registryStats();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Administration" title="Admin" subtitle="System monitoring, user management and audit log. Admin-only." />

      <div className="stagger mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { k: users.length, v: "Users" },
          { k: investigations.length, v: "Investigations" },
          { k: cases.length, v: "Cases" },
          { k: keys.length, v: "Active keys" },
          { k: reg.total, v: "Sources" },
        ].map((s) => (
          <StatCard key={s.v} k={s.k} v={s.v} />
        ))}
      </div>

      <SectionTitle action={<span className="chip !py-0.5 text-[11px] tabular-nums">{users.length} total</span>}>Users</SectionTitle>
      <AdminClient initial={users} me={session.user.id} />

      <div className="mt-8" />
      <SectionTitle action={<span className="text-xs text-faint">Latest 25 events</span>}>Audit log</SectionTitle>
      <div className="panel divide-y divide-white/[0.05] overflow-hidden">
        {audit.length === 0 && <div className="px-4 py-10 text-center text-sm text-faint">No events yet.</div>}
        {audit.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/[0.02]">
            <div className="flex min-w-0 items-center gap-3">
              <span className="chip mono flex-none !py-0.5 text-[11px]">{e.action}</span>
              <span className="truncate text-faint">{e.target || ""}</span>
            </div>
            <span className="flex-none text-xs tabular-nums text-faint">{new Date(e.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
