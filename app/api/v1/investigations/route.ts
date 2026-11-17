import { db, uid, audit } from "@/lib/db";
import { requireUser, isUser, json, err } from "@/lib/apiutil";
import { detectIdentifier } from "@/lib/detect";
import { runAll, summarize } from "@/lib/sources/runner";
import type { Investigation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/investigations  { "input": "example.com", "save": true }
export async function POST(req: Request) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  let body: { input?: string; save?: boolean; disabled?: string[] };
  try {
    body = await req.json();
  } catch {
    return err("invalid JSON body");
  }
  const input = (body.input || "").trim();
  if (!input) return err("input required");

  const det = detectIdentifier(input);
  const start = Date.now();
  const results = await runAll({
    input,
    identifierType: det.identifierType,
    normalized: det.normalized,
    env: process.env as Record<string, string | undefined>,
    disabled: new Set(body.disabled || []),
  });
  const inv: Investigation = {
    id: uid("inv_"),
    userId: u.id,
    input,
    identifierType: det.identifierType,
    normalized: det.normalized,
    createdAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    results,
    stats: summarize(results),
    saved: !!body.save,
  };
  if (body.save) await db.insert("investigations", inv);
  await audit("api.investigation", u.id, inv.id, { type: det.identifierType });
  return json({ investigation: inv });
}

// GET /api/v1/investigations
export async function GET(req: Request) {
  const u = requireUser(req);
  if (!isUser(u)) return u;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "25", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const all = db
    .filter("investigations", (i) => i.userId === u.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = all.slice(offset, offset + limit).map((i) => ({
    id: i.id,
    input: i.input,
    identifierType: i.identifierType,
    createdAt: i.createdAt,
    stats: i.stats,
  }));
  return json({ total: all.length, limit, offset, investigations: page });
}
