import { cookies } from "next/headers";
import { db, uid, audit } from "@/lib/db";
import { hashPassword, createSession, sessionCookie, publicUser } from "@/lib/auth";
import { json, err } from "@/lib/apiutil";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return err("invalid JSON body");
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("invalid email");
  if (password.length < 8) return err("password must be at least 8 characters");

  if (db.find("users", (u) => u.email === email)) {
    return err("an account with that email already exists", 409);
  }

  const { hash, salt } = hashPassword(password);
  const allUsers = db.all("users");
  const isFirst = allUsers.length === 0;
  const nextUid = allUsers.length + 1; // sequential UID (1 = first ever registration)
  const user: User = {
    id: uid("usr_"),
    uid: nextUid,
    email,
    passwordHash: hash,
    salt,
    role: isFirst ? "admin" : "user",
    createdAt: new Date().toISOString(),
    verified: true, // local/self-hosted: auto-verify (wire SMTP for production)
    displayName: body.displayName?.trim() || email.split("@")[0],
  };
  await db.insert("users", user);
  await audit("user.register", user.id, user.email, { role: user.role });

  const session = await createSession(user.id, req.headers.get("user-agent") || undefined);
  const c = sessionCookie(session);
  cookies().set(c.name, c.value, c.options);

  return json({ user: publicUser(user), firstUser: isFirst });
}
