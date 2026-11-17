import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { registryStats } from "@/lib/sources/registry";
import { PageHeader } from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const { user } = getCurrentUser()!;
  const investigations = db.filter("investigations", (i) => i.userId === user.id);
  const cases = db.filter("cases", (c) => c.userId === user.id);
  const reg = registryStats();
  const recent = [...investigations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const totalFindings = investigations.reduce((n, i) => n + (i.stats?.totalFindings || 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome back, ${user.displayName}`}
        subtitle="Your investigation console at a glance."
        actions={<Link href="/investigate" className="btn-primary">New investigation</Link>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric k={investigations.length} v="Investigations" />
        <Metric k={cases.length} v="Cases" />
        <Metric k={totalFindings} v="Findings collected" />
        <Metric k={`${reg.integrated}`} v="Live sources" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Recent investigations</h2>
            <Link href="/history" className="link text-sm">View all</Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">
              No investigations yet. <Link href="/investigate" className="link">Start your first one.</Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recent.map((i) => (
                <Link key={i.id} href={`/history#${i.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                  <div className="min-w-0">
                    <div className="mono truncate text-sm">{i.normalized}</div>
                    <div className="text-xs text-faint">{i.identifierType} · {new Date(i.createdAt).toLocaleString()}</div>
                  </div>
                  <span className="chip !py-0.5 text-[11px]">{i.stats?.uniqueFindings ?? 0} findings</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <h2 className="mb-3 font-medium">Source registry</h2>
            <div className="space-y-2 text-sm">
              <Row label="Live (keyless)" value={reg.integrated} color="bg-emerald-400" />
              <Row label="Key-ready" value={reg.requires_key} color="bg-violet-400" />
              <Row label="Public web" value={reg.public_web} color="bg-sky-400" />
              <Row label="Planned" value={reg.planned} color="bg-white/30" />
              <div className="mt-2 border-t border-white/5 pt-2 text-faint">Total registered: {reg.total}</div>
            </div>
            <Link href="/sources" className="btn mt-3 w-full">Manage sources</Link>
          </div>
          <div className="panel p-5">
            <h2 className="mb-2 font-medium">Quick actions</h2>
            <div className="grid gap-2">
              <Link href="/investigate" className="btn justify-start">Run an investigation</Link>
              <Link href="/cases" className="btn justify-start">Open cases</Link>
              <Link href="/api-dev" className="btn justify-start">Create API key</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ k, v }: { k: number | string; v: string }) {
  return (
    <div className="panel p-5">
      <div className="text-3xl font-semibold tracking-tight">{k}</div>
      <div className="mt-1 text-sm text-muted">{v}</div>
    </div>
  );
}
function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted"><span className={`h-1.5 w-1.5 rounded-full ${color}`} />{label}</span>
      <span>{value}</span>
    </div>
  );
}
