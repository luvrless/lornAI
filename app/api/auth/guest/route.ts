import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, uid, audit } from "@/lib/db";
import { createSession, sessionCookie, publicUser } from "@/lib/auth";
import type { User } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const destination = url.searchParams.get("to") || "/overview";
  const safeDestination = destination.startsWith("/") && !destination.startsWith("//")
    ? destination
    : "/overview";

  const guestEmail = "guest@lorn.local";
  let user = db.find("users", (u) => u.email === guestEmail);

  if (!user) {
    user = {
      id: uid("usr_"),
      uid: (db.all("users").length || 0) + 1,
      email: guestEmail,
      passwordHash: "",
      salt: "",
      role: "user",
      createdAt: new Date().toISOString(),
      verified: true,
      displayName: "Guest Investigator",
    } satisfies User;
    await db.insert("users", user);
  }

  const session = await createSession(user.id, req.headers.get("user-agent") || undefined);
  const c = sessionCookie(session);
  const response = NextResponse.redirect(new URL(safeDestination, req.url));
  response.cookies.set(c.name, c.value, c.options);
  await audit("user.login.guest", user.id, guestEmail);

  // Keep publicGuest/profile data out of server logs and browser storage.
  void publicUser;
  void cookies;
  return response;
}
