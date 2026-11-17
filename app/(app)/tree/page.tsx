import { PageHeader } from "@/components/ui";
import { TreeExplorer } from "@/components/TreeExplorer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TreePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Intelligence"
        title="OSINT Framework Tree"
        subtitle="Massive hierarchical intelligence tree. Navigate hundreds of data branches or launch instant queries across all domains."
      />
      <TreeExplorer />
    </div>
  );
}
