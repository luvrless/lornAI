import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionId, destroySession } from "@/lib/auth";
import { json } from "@/lib/apiutil";

export const runtime = "nodejs";

export async function POST() {
  const c = cookies().get(SESSION_COOKIE)?.value;
  const sid = readSessionId(c);
  if (sid) await destroySession(sid);
  cookies().delete(SESSION_COOKIE);
  return json({ ok: true });
}
