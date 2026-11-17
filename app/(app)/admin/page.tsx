import { redirect } from "next/navigation";
import { getCurrentUser, hasRole, publicUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { registryStats } from "@/lib/sources/registry";
import { PageHeader } from "@/components/ui";
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
      <PageHeader title="Admin" subtitle="System monitoring, user management and audit log. Admin-only." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { k: users.length, v: "Users" },
          { k: investigations.length, v: "Investigations" },
          { k: cases.length, v: "Cases" },
          { k: keys.length, v: "Active keys" },
          { k: reg.total, v: "Sources" },
        ].map((s) => (
          <div key={s.v} className="panel p-4">
            <div className="text-2xl font-semibold">{s.k}</div>
            <div className="text-xs text-muted">{s.v}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 font-medium">Users</h2>
      <AdminClient initial={users} me={session.user.id} />

      <h2 className="mb-2 mt-6 font-medium">Audit log</h2>
      <div className="panel divide-y divide-white/5 overflow-hidden">
        {audit.length === 0 && <div className="px-4 py-6 text-center text-sm text-faint">No events yet.</div>}
        {audit.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="flex items-center gap-3">
              <span className="chip !py-0.5 text-[11px]">{e.action}</span>
              <span className="text-faint">{e.target || ""}</span>
            </div>
            <span className="text-xs text-faint">{new Date(e.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
