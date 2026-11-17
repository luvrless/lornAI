import { ALL_SOURCE_METAS, registryStats } from "@/lib/sources/registry";
import { json } from "@/lib/apiutil";

export const runtime = "nodejs";

// Public: the source registry is not secret. Credentials are never exposed.
export async function GET() {
  return json({ stats: registryStats(), sources: ALL_SOURCE_METAS });
}
