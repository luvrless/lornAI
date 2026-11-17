import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { db, uid, audit } from "./db";
import type { User, Session, Role } from "./types";

export const SESSION_COOKIE = "lorn_session";
const SESSION_TTL_DAYS = 30;

function getSecret(): string {
  if (process.env.LORN_SECRET) return process.env.LORN_SECRET;
  const dir = path.join(process.cwd(), "data");
  const fp = path.join(dir, ".secret");
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(fp)) return fs.readFileSync(fp, "utf8").trim();
    const s = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(fp, s, { mode: 0o600 });
    return s;
  } catch {
    return "lorn-dev-insecure-secret-change-me";
  }
}

// ---- Password hashing (scrypt, no native deps) ----

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string
): boolean {
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// ---- Signed session cookie ----

function sign(value: string): string {
  const mac = crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("hex");
  return `${value}.${mac}`;
}

function unsign(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i === -1) return null;
  const value = signed.slice(0, i);
  const mac = signed.slice(i + 1);
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("hex");
  try {
    if (
      mac.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
    ) {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

export async function createSession(
  userId: string,
  userAgent?: string
): Promise<Session> {
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 864e5);
  const session: Session = {
    id: uid("sess_"),
    userId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    userAgent,
  };
  await db.insert("sessions", session);
  return session;
}

export function sessionCookie(session: Session) {
  return {
    name: SESSION_COOKIE,
    value: sign(session.id),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(session.expiresAt),
    },
  };
}

export function readSessionId(signedValue: string | undefined): string | null {
  if (!signedValue) return null;
  return unsign(signedValue);
}

// ---- Current user resolution (server components / route handlers) ----

export function getCurrentUser(): { user: User; session: Session } | null {
  const c = cookies().get(SESSION_COOKIE)?.value;
  const sid = readSessionId(c);
  if (!sid) return null;
  const session = db.find("sessions", (s) => s.id === sid);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  const user = db.find("users", (u) => u.id === session.userId);
  if (!user || user.suspended) return null;
  return { user, session };
}

export function publicUser(u: User) {
  const { passwordHash, salt, ...rest } = u;
  void passwordHash;
  void salt;
  return rest;
}

export async function destroySession(sid: string) {
  await db.remove("sessions", sid);
}

// ---- Role helpers ----

const RANK: Record<Role, number> = { user: 0, moderator: 1, admin: 2 };
export function hasRole(user: User, min: Role): boolean {
  return RANK[user.role] >= RANK[min];
}

// ---- API key auth (public REST API) ----

export function newApiKey(): { full: string; prefix: string; hash: string } {
  const raw = crypto.randomBytes(24).toString("base64url");
  const full = `lorn_sk_${raw}`;
  const prefix = full.slice(0, 14);
  const hash = crypto.createHash("sha256").update(full).digest("hex");
  return { full, prefix, hash };
}

export function hashApiKey(full: string): string {
  return crypto.createHash("sha256").update(full).digest("hex");
}

export function authenticateApiKey(authHeader: string | null): User | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : authHeader.trim();
  if (!token.startsWith("lorn_sk_")) return null;
  const hash = hashApiKey(token);
  const key = db.find("apikeys", (k) => k.hash === hash && !k.revoked);
  if (!key) return null;
  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now())
    return null;
  const user = db.find("users", (u) => u.id === key.userId);
  if (!user || user.suspended) return null;
  // fire and forget last-used update
  void db.update("apikeys", key.id, { lastUsedAt: new Date().toISOString() });
  return user;
}

export { audit };
