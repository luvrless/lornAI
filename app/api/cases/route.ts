import { db, uid, audit } from "@/lib/db";
import { requireUser, isUser, json, err } from "@/lib/apiutil";
import type { InvestigationCase } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const cases = db
    .filter("cases", (c) => c.userId === u.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((c) => ({ ...c, investigationCount: c.investigationIds.length }));
  return json({ cases });
}

export async function POST(req: Request) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  let body: { title?: string; description?: string; tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return err("invalid body");
  }
  if (!body.title?.trim()) return err("title required");
  const now = new Date().toISOString();
  const c: InvestigationCase = {
    id: uid("case_"),
    userId: u.id,
    title: body.title.trim(),
    description: body.description?.trim() || "",
    status: "open",
    tags: body.tags || [],
    createdAt: now,
    updatedAt: now,
    investigationIds: [],
    notes: [],
  };
  await db.insert("cases", c);
  await audit("case.create", u.id, c.id);
  return json({ case: c });
}
