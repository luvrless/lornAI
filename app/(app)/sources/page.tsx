import { ALL_SOURCE_METAS, registryStats } from "@/lib/sources/registry";
import { PageHeader, StatCard } from "@/components/ui";
import { SourcesExplorer } from "@/components/SourcesExplorer";

export const runtime = "nodejs";

export default function SourcesPage() {
  const stats = registryStats();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Intelligence"
        title="Data Sources"
        subtitle={`${stats.total} registered intelligence sources. Status is honest — a source runs only when it has a working adapter.`}
      />
      <div className="stagger mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { k: stats.total, v: "Total" },
          { k: stats.integrated, v: "Live" },
          { k: stats.requires_key, v: "Needs key" },
          { k: stats.public_web, v: "Public web" },
          { k: stats.planned, v: "Planned" },
        ].map((s) => (
          <StatCard key={s.v} k={s.k} v={s.v} />
        ))}
      </div>
      <SourcesExplorer sources={ALL_SOURCE_METAS} />
    </div>
  );
}
