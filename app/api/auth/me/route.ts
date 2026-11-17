import { getCurrentUser, publicUser } from "@/lib/auth";
import { json } from "@/lib/apiutil";

export const runtime = "nodejs";

export async function GET() {
  const session = getCurrentUser();
  if (!session) return json({ user: null });
  return json({ user: publicUser(session.user) });
}
