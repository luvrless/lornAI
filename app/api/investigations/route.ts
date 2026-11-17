import { db, uid, audit } from "@/lib/db";
import { requireUser, isUser, json, err } from "@/lib/apiutil";
import type { Investigation } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const list = db
    .filter("investigations", (i) => i.userId === u.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => ({
      id: i.id,
      input: i.input,
      identifierType: i.identifierType,
      normalized: i.normalized,
      createdAt: i.createdAt,
      stats: i.stats,
      saved: i.saved,
      caseId: i.caseId,
    }));
  return json({ investigations: list });
}

export async function POST(req: Request) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  let body: { investigation?: Investigation; caseId?: string };
  try {
    body = await req.json();
  } catch {
    return err("invalid body");
  }
  const inv = body.investigation;
  if (!inv || !inv.input || !Array.isArray(inv.results)) return err("invalid investigation payload");

  const record: Investigation = {
    ...inv,
    id: uid("inv_"),
    userId: u.id,
    saved: true,
    caseId: body.caseId || null,
    createdAt: inv.createdAt || new Date().toISOString(),
  };
  await db.insert("investigations", record);

  if (body.caseId) {
    const c = db.find("cases", (x) => x.id === body.caseId && x.userId === u.id);
    if (c) {
      await db.update("cases", c.id, {
        investigationIds: [...c.investigationIds, record.id],
        updatedAt: new Date().toISOString(),
      });
    }
  }
  await audit("investigation.save", u.id, record.id, { type: record.identifierType });
  return json({ id: record.id, saved: true });
}
