import { ALL_SOURCE_METAS, registryStats } from "@/lib/sources/registry";
import { requireUser, isUser, json } from "@/lib/apiutil";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  return json({ stats: registryStats(), sources: ALL_SOURCE_METAS });
}
