import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { GraphView } from "@/components/GraphView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function GraphPage() {
  const { user } = getCurrentUser()!;
  const investigations = db
    .filter("investigations", (i) => i.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => ({ id: i.id, input: i.input, normalized: i.normalized, identifierType: i.identifierType }));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Graph Analysis" subtitle="Evidence-linked relationships between entities. Connections are drawn only from observed source findings." />
      <GraphView investigations={investigations} />
    </div>
  );
}
