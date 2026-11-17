import { db } from "@/lib/db";
import { requireUser, isUser, json, err } from "@/lib/apiutil";
import { buildGraph } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const inv = db.find("investigations", (i) => i.id === params.id && i.userId === u.id);
  if (!inv) return err("not found", 404);
  return json({ graph: buildGraph(inv), investigation: { id: inv.id, normalized: inv.normalized } });
}
