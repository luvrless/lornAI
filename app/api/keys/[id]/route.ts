import { db, audit } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { json, err } from "@/lib/apiutil";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const s = getCurrentUser();
  if (!s) return err("authentication required", 401);
  const key = db.find("apikeys", (k) => k.id === params.id && k.userId === s.user.id);
  if (!key) return err("not found", 404);
  await db.update("apikeys", key.id, { revoked: true });
  await audit("apikey.revoke", s.user.id, key.id);
  return json({ revoked: true });
}
