import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CasesClient } from "@/components/CasesClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function CasesPage() {
  const { user } = getCurrentUser()!;
  const cases = db
    .filter("cases", (c) => c.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((c) => ({ ...c, investigationCount: c.investigationIds.length }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Workspace" title="Cases" subtitle="Organize investigations, notes and evidence. Private by default." />
      <CasesClient initial={cases} />
    </div>
  );
}
