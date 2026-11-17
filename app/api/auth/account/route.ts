import { cookies } from "next/headers";
import { db, audit } from "@/lib/db";
import {
  getCurrentUser,
  hashPassword,
  verifyPassword,
  publicUser,
  SESSION_COOKIE,
} from "@/lib/auth";
import { json, err } from "@/lib/apiutil";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const s = getCurrentUser();
  if (!s) return err("authentication required", 401);
  let body: { displayName?: string; currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return err("invalid body");
  }
  const patch: Record<string, unknown> = {};
  if (body.displayName !== undefined) patch.displayName = body.displayName.trim();
  if (body.newPassword) {
    if ((body.newPassword || "").length < 8) return err("new password too short");
    if (!verifyPassword(body.currentPassword || "", s.user.passwordHash, s.user.salt))
      return err("current password incorrect", 403);
    const { hash, salt } = hashPassword(body.newPassword);
    patch.passwordHash = hash;
    patch.salt = salt;
  }
  const updated = await db.update("users", s.user.id, patch);
  await audit("account.update", s.user.id);
  return json({ user: updated ? publicUser(updated) : null });
}

export async function DELETE() {
  const s = getCurrentUser();
  if (!s) return err("authentication required", 401);
  const uid = s.user.id;
  // remove user's data (data minimization / right to erasure)
  for (const inv of db.filter("investigations", (i) => i.userId === uid)) await db.remove("investigations", inv.id);
  for (const c of db.filter("cases", (c) => c.userId === uid)) await db.remove("cases", c.id);
  for (const k of db.filter("apikeys", (k) => k.userId === uid)) await db.remove("apikeys", k.id);
  for (const sess of db.filter("sessions", (x) => x.userId === uid)) await db.remove("sessions", sess.id);
  await db.remove("users", uid);
  await audit("account.delete", uid);
  cookies().delete(SESSION_COOKIE);
  return json({ deleted: true });
}
