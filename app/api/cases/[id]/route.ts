import { db, uid, audit } from "@/lib/db";
import { requireUser, isUser, json, err } from "@/lib/apiutil";
import type { CaseStatus } from "@/lib/types";

export const runtime = "nodejs";

function getCase(userId: string, id: string) {
  return db.find("cases", (c) => c.id === id && c.userId === userId);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const c = getCase(u.id, params.id);
  if (!c) return err("not found", 404);
  const investigations = db
    .filter("investigations", (i) => c.investigationIds.includes(i.id))
    .map((i) => ({
      id: i.id,
      input: i.input,
      identifierType: i.identifierType,
      createdAt: i.createdAt,
      stats: i.stats,
    }));
  return json({ case: c, investigations });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const c = getCase(u.id, params.id);
  if (!c) return err("not found", 404);
  let body: {
    title?: string;
    description?: string;
    status?: CaseStatus;
    tags?: string[];
    addNote?: string;
    attachInvestigation?: string;
    detachInvestigation?: string;
  };
  try {
    body = await req.json();
  } catch {
    return err("invalid body");
  }
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.description !== undefined) patch.description = body.description;
  if (body.status) patch.status = body.status;
  if (body.tags) patch.tags = body.tags;
  if (body.addNote?.trim()) {
    patch.notes = [
      ...c.notes,
      { id: uid("note_"), body: body.addNote.trim(), createdAt: new Date().toISOString() },
    ];
  }
  if (body.attachInvestigation) {
    const inv = db.find("investigations", (i) => i.id === body.attachInvestigation && i.userId === u.id);
    if (inv && !c.investigationIds.includes(inv.id)) {
      patch.investigationIds = [...c.investigationIds, inv.id];
      await db.update("investigations", inv.id, { caseId: c.id });
    }
  }
  if (body.detachInvestigation) {
    patch.investigationIds = c.investigationIds.filter((x) => x !== body.detachInvestigation);
  }
  const updated = await db.update("cases", c.id, patch);
  await audit("case.update", u.id, c.id);
  return json({ case: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const c = getCase(u.id, params.id);
  if (!c) return err("not found", 404);
  await db.remove("cases", c.id);
  await audit("case.delete", u.id, c.id);
  return json({ deleted: true });
}
