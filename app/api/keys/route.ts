import { db, uid, audit } from "@/lib/db";
import { getCurrentUser, newApiKey } from "@/lib/auth";
import { json, err } from "@/lib/apiutil";
import type { ApiKey } from "@/lib/types";

export const runtime = "nodejs";

// API keys can only be managed via a dashboard session, never via an API key.
export async function GET() {
  const s = getCurrentUser();
  if (!s) return err("authentication required", 401);
  const keys = db
    .filter("apikeys", (k) => k.userId === s.user.id && !k.revoked)
    .map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
    }));
  return json({ keys });
}

export async function POST(req: Request) {
  const s = getCurrentUser();
  if (!s) return err("authentication required", 401);
  let body: { name?: string; scopes?: string[]; expiresInDays?: number };
  try {
    body = await req.json();
  } catch {
    return err("invalid body");
  }
  const { full, prefix, hash } = newApiKey();
  const key: ApiKey = {
    id: uid("key_"),
    userId: s.user.id,
    name: body.name?.trim() || "API key",
    prefix,
    hash,
    scopes: body.scopes?.length ? body.scopes : ["investigations:read", "investigations:write", "sources:read", "cases:read"],
    createdAt: new Date().toISOString(),
    expiresAt: body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 864e5).toISOString()
      : null,
    lastUsedAt: null,
  };
  await db.insert("apikeys", key);
  await audit("apikey.create", s.user.id, key.id);
  // full key returned ONCE
  return json({ key: { id: key.id, name: key.name, prefix, scopes: key.scopes }, secret: full });
}
