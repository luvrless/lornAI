import { db, audit } from "@/lib/db";
import { getCurrentUser, hasRole, publicUser } from "@/lib/auth";
import { json, err } from "@/lib/apiutil";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const s = getCurrentUser();
  if (!s || !hasRole(s.user, "admin")) return err("forbidden", 403);
  const users = db.all("users").map(publicUser);
  return json({ users });
}

export async function PATCH(req: Request) {
  const s = getCurrentUser();
  if (!s || !hasRole(s.user, "admin")) return err("forbidden", 403);
  let body: { userId?: string; role?: Role; suspended?: boolean };
  try {
    body = await req.json();
  } catch {
    return err("invalid body");
  }
  const target = db.find("users", (u) => u.id === body.userId);
  if (!target) return err("user not found", 404);
  if (target.id === s.user.id && (body.role && body.role !== "admin"))
    return err("cannot demote yourself", 400);
  const patch: Record<string, unknown> = {};
  if (body.role) patch.role = body.role;
  if (typeof body.suspended === "boolean") patch.suspended = body.suspended;
  const updated = await db.update("users", target.id, patch);
  await audit("admin.user.update", s.user.id, target.id, patch);
  return json({ user: updated ? publicUser(updated) : null });
}
