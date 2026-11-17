import { db, audit } from "@/lib/db";
import { requireUser, isUser, json, err } from "@/lib/apiutil";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const inv = db.find("investigations", (i) => i.id === params.id && i.userId === u.id);
  if (!inv) return err("not found", 404);
  return json({ investigation: inv });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const inv = db.find("investigations", (i) => i.id === params.id && i.userId === u.id);
  if (!inv) return err("not found", 404);
  await db.remove("investigations", inv.id);
  // detach from any case
  for (const c of db.filter("cases", (c) => c.investigationIds.includes(inv.id))) {
    await db.update("cases", c.id, {
      investigationIds: c.investigationIds.filter((x) => x !== inv.id),
    });
  }
  await audit("investigation.delete", u.id, inv.id);
  return json({ deleted: true });
}
