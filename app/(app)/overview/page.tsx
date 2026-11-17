import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { registryStats } from "@/lib/sources/registry";
import { Icon, ICONS, PageHeader, StatCard } from "@/components/ui";

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
        eyebrow="Overview"
        title={`Welcome back, ${user.displayName}`}
        subtitle="Your investigation console at a glance."
        actions={
          <Link href="/investigate" className="btn-primary">
            <Icon d={ICONS.plus} className="h-4 w-4" strokeWidth={2.2} />
            New investigation
          </Link>
        }
      />

      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard k={investigations.length} v="Investigations" dot="bg-accent-blue" />
        <StatCard k={cases.length} v="Cases" dot="bg-accent-violet" />
        <StatCard k={totalFindings} v="Findings collected" dot="bg-accent-sky" />
        <StatCard k={`${reg.integrated}`} v="Live sources" dot="bg-emerald-400" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="panel animate-rise p-5 sm:p-6" style={{ animationDelay: "120ms" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">Recent investigations</h2>
            <Link href="/history" className="btn-ghost">
              View all
              <Icon d={ICONS.chevronRight} className="h-3.5 w-3.5" strokeWidth={2.2} />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="icon-tile mb-4 h-12 w-12">
                <Icon d={ICONS.search} className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted">
                No investigations yet. <Link href="/investigate" className="link">Start your first one.</Link>
              </p>
            </div>
          ) : (
            <div className="-mx-2 space-y-0.5">
              {recent.map((i) => (
                <Link
                  key={i.id}
                  href={`/history#${i.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-white/[0.04]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/[0.04] text-faint ring-1 ring-white/[0.06] transition-colors group-hover:text-accent-sky">
                      <Icon d={ICONS.search} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="mono truncate text-sm">{i.normalized}</div>
                      <div className="text-xs text-faint">{i.identifierType} · {new Date(i.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <span className="chip !py-0.5 text-[11px] tabular-nums">{i.stats?.uniqueFindings ?? 0} findings</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="panel animate-rise p-5 sm:p-6" style={{ animationDelay: "180ms" }}>
            <h2 className="mb-4 text-[15px] font-semibold tracking-tight">Source registry</h2>
            <RegistryBar reg={reg} />
            <div className="mt-4 space-y-2.5 text-sm">
              <Row label="Live (keyless)" value={reg.integrated} color="bg-emerald-400" />
              <Row label="Key-ready" value={reg.requires_key} color="bg-violet-400" />
              <Row label="Public web" value={reg.public_web} color="bg-sky-400" />
              <Row label="Planned" value={reg.planned} color="bg-white/30" />
              <div className="divider !my-3" />
              <div className="flex justify-between text-faint"><span>Total registered</span><span className="tabular-nums">{reg.total}</span></div>
            </div>
            <Link href="/sources" className="btn mt-4 w-full">Manage sources</Link>
          </div>
          <div className="panel animate-rise p-5 sm:p-6" style={{ animationDelay: "240ms" }}>
            <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Quick actions</h2>
            <div className="grid gap-2">
              <QuickLink href="/investigate" icon={ICONS.search} label="Run an investigation" />
              <QuickLink href="/cases" icon={ICONS.folder} label="Open cases" />
              <QuickLink href="/api-dev" icon={ICONS.key} label="Create API key" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegistryBar({ reg }: { reg: ReturnType<typeof registryStats> }) {
  const total = Math.max(1, reg.integrated + reg.requires_key + reg.public_web + reg.planned);
  const seg = [
    { v: reg.integrated, c: "bg-emerald-400" },
    { v: reg.requires_key, c: "bg-violet-400" },
    { v: reg.public_web, c: "bg-sky-400" },
    { v: reg.planned, c: "bg-white/25" },
  ];
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/5">
      {seg.map((s, i) => (
        <div key={i} className={`h-full ${s.c}`} style={{ width: `${(s.v / total) * 100}%` }} />
      ))}
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="btn group justify-start !py-2.5">
      <Icon d={icon} className="h-4 w-4 text-faint transition-colors group-hover:text-accent-sky" />
      {label}
      <Icon d={ICONS.chevronRight} className="ml-auto h-3.5 w-3.5 text-faint transition-transform duration-300 ease-ios group-hover:translate-x-0.5" strokeWidth={2.2} />
    </Link>
  );
}

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted"><span className={`h-1.5 w-1.5 rounded-full ${color}`} />{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
