import { NextResponse } from "next/server";
import type { User } from "./types";
import { getCurrentUser, authenticateApiKey } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: message, requestId: crypto.randomUUID(), ...extra },
    { status }
  );
}

// Resolve a user from either a session cookie (dashboard) or API key (public API)
export function resolveUser(req: Request): User | null {
  const session = getCurrentUser();
  if (session) return session.user;
  const key = authenticateApiKey(req.headers.get("authorization"));
  return key;
}

export function requireUser(req: Request): User | NextResponse {
  const u = resolveUser(req);
  if (!u) return err("authentication required", 401);
  return u;
}

export function isUser(x: User | NextResponse): x is User {
  return !(x instanceof NextResponse);
}
