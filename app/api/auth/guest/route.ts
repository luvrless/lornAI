import { NextResponse } from "next/server";
import { db, uid, audit } from "@/lib/db";
import { createSession, getCurrentUser, sessionCookie } from "@/lib/auth";
import type { User } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const destination = url.searchParams.get("to") || "/overview";
  const safeDestination = destination.startsWith("/") && !destination.startsWith("//")
    ? destination
    : "/overview";

  // Reuse this browser's guest account, but never share guest data across visitors.
  let user: User | undefined = getCurrentUser()?.user.guest
    ? getCurrentUser()!.user
    : undefined;

  if (!user) {
    const id = uid("usr_");
    user = {
      id,
      uid: db.all("users").length + 1,
      email: `guest-${id.slice(-12)}@guest.lorn.local`,
      passwordHash: "",
      salt: "",
      role: "user",
      createdAt: new Date().toISOString(),
      verified: true,
      displayName: "Guest Investigator",
      guest: true,
    };
    await db.insert("users", user);
  }

  const session = await createSession(user.id, req.headers.get("user-agent") || undefined);
  const c = sessionCookie(session);
  const response = NextResponse.redirect(new URL(safeDestination, req.url));
  response.cookies.set(c.name, c.value, c.options);
  await audit("user.login.guest", user.id);
  return response;
}
