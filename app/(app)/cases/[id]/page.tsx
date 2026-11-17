import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CaseDetail } from "@/components/CaseDetail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  const auth = getCurrentUser();
  if (!auth) notFound();
  const { user } = auth;
  const c = db.find("cases", (x) => x.id === params.id && x.userId === user.id);
  if (!c) notFound();
  const caseItem = c!;
  const investigations = db
    .filter("investigations", (i) => caseItem.investigationIds.includes(i.id))
    .map((i) => ({
      id: i.id,
      input: i.input,
      identifierType: i.identifierType,
      createdAt: i.createdAt,
      stats: { uniqueFindings: i.stats?.uniqueFindings ?? 0 },
    }));
  return <CaseDetail initial={caseItem} investigations={investigations} />;
}
