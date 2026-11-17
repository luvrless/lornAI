import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { Investigate } from "@/components/Investigate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function InvestigatePage() {
  const session = getCurrentUser()!;
  const cases = db
    .filter("cases", (c) => c.userId === session.user.id)
    .map((c) => ({ id: c.id, title: c.title }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Investigate"
        subtitle="One identifier in. Every eligible source, concurrently. Real results only."
      />
      <Investigate cases={cases} />
    </div>
  );
}
