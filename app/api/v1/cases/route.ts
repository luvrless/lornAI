import { db } from "@/lib/db";
import { requireUser, isUser, json } from "@/lib/apiutil";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const cases = db
    .filter("cases", (c) => c.userId === u.id)
    .map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      tags: c.tags,
      investigationCount: c.investigationIds.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  return json({ cases });
}
