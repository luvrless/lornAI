import { cookies } from "next/headers";
import { db, audit } from "@/lib/db";
import { verifyPassword, createSession, sessionCookie, publicUser } from "@/lib/auth";
import { json, err } from "@/lib/apiutil";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return err("invalid JSON body");
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const user = db.find("users", (u) => u.email === email);
  // constant-ish response to avoid user enumeration
  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return err("invalid email or password", 401);
  }
  if (user.suspended) return err("account suspended", 403);

  const session = await createSession(user.id, req.headers.get("user-agent") || undefined);
  const c = sessionCookie(session);
  cookies().set(c.name, c.value, c.options);
  await audit("user.login", user.id, user.email);
  return json({ user: publicUser(user) });
}
