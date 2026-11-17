import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { InvestigationsList } from "@/components/InvestigationsList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function HistoryPage() {
  const { user } = getCurrentUser()!;
  const rows = db
    .filter("investigations", (i) => i.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => ({
      id: i.id,
      input: i.input,
      normalized: i.normalized,
      identifierType: i.identifierType,
      createdAt: i.createdAt,
      stats: {
        attempted: i.stats?.attempted ?? 0,
        completed: i.stats?.completed ?? 0,
        uniqueFindings: i.stats?.uniqueFindings ?? 0,
        failed: i.stats?.failed ?? 0,
      },
    }));
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="History" subtitle="Every saved investigation, newest first. Expand to review full results." />
      <InvestigationsList initial={rows} />
    </div>
  );
}
