/**
 * Emailed 6-digit codes and remembered devices.
 *
 * - Codes are stored hashed, expire in 10 minutes, work once, and die after 5 wrong tries.
 * - A browser that passes a code is remembered for the session idle window (14 days, sliding),
 *   so the code is asked again on a new browser or after two weeks away.
 */
import crypto from "node:crypto";
import type { App, Queryable } from "../../app.ts";
import type { Ctx } from "../../lib/http.ts";
import { HttpError } from "../../lib/errors.ts";
import { hmac, randomToken, sha256 } from "../../lib/crypto.ts";
import { getSetting, queueEmail } from "../platform/service.ts";
import { emails } from "../../lib/email-templates.ts";

export type CodePurpose = "verify_email" | "login";
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const DEVICE_COOKIE = "lorn_device";

export const mailConfigured = (app: App) => !!(app.cfg.resend || app.cfg.smtp);
export const idleDays = (app: App) => getSetting<number>(app, "security.session_idle_days", 14);

const hashCode = (app: App, userId: string, purpose: CodePurpose, code: string) =>
  sha256(hmac(app.cfg.sessionSecret, `code:${userId}:${purpose}:${code}`));

export async function issueEmailCode(app: App, db: Queryable, userId: string, purpose: CodePurpose, sessionId?: string) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await db.query("UPDATE email_codes SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL", [userId, purpose]);
  await db.query(
    "INSERT INTO email_codes (user_id, purpose, session_id, code_hash, expires_at) VALUES ($1,$2,$3,$4, now() + make_interval(mins => $5))",
    [userId, purpose, sessionId ?? null, hashCode(app, userId, purpose, code), CODE_TTL_MIN]);
  return code;
}

/** Check a code. Wrong guesses are counted against the newest live code and exhaust it. */
export async function consumeEmailCode(app: App, userId: string, purpose: CodePurpose, raw: string, sessionId?: string) {
  const code = raw.replace(/\D/g, "");
  const row = (await app.db.query(
    `SELECT id, code_hash, attempts, session_id FROM email_codes
     WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now() ORDER BY id DESC LIMIT 1`, [userId, purpose])).rows[0];
  if (!row || (row.session_id && sessionId && row.session_id !== sessionId)) throw new HttpError(400, "code_expired", "That code has expired. Request a new one.");
  if (row.attempts >= MAX_ATTEMPTS) {
    await app.db.query("UPDATE email_codes SET used_at = now() WHERE id = $1", [row.id]);
    throw new HttpError(400, "code_expired", "Too many wrong tries. Request a new code.");
  }
  const ok = code.length === 6 && crypto.timingSafeEqual(Buffer.from(row.code_hash), hashCode(app, userId, purpose, code));
  if (!ok) {
    await app.db.query("UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
    throw new HttpError(400, "invalid_code", "That code isn't right. Check the email and try again.");
  }
  const used = await app.db.query("UPDATE email_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL", [row.id]);
  if (!used.rowCount) throw new HttpError(400, "code_expired", "That code has expired. Request a new one.");
}

export async function sendLoginCode(app: App, user: { id: string; username: string; email: string }, sessionId: string, device: string) {
  const code = await issueEmailCode(app, app.db, user.id, "login", sessionId);
  return queueEmail(app, app.db, { to: user.email, userId: user.id, ...emails.loginCode(app.cfg.appUrl, { username: user.username, code, device }) });
}

// ---------------------------------------------------------------- remembered devices

export async function isTrustedDevice(app: App, c: Ctx, userId: string) {
  const t = c.cookies[DEVICE_COOKIE];
  if (!t) return false;
  const days = await idleDays(app);
  const r = await app.db.query(
    "UPDATE trusted_devices SET last_used_at = now(), expires_at = now() + make_interval(days => $3) WHERE token_hash = $1 AND user_id = $2 AND expires_at > now()",
    [sha256(t), userId, days]);
  if (r.rowCount) c.setCookie(DEVICE_COOKIE, t, { maxAge: 60 * 60 * 24 * days, sameSite: "Lax" });
  return !!r.rowCount;
}

export async function trustDevice(app: App, c: Ctx, userId: string) {
  const days = await idleDays(app);
  const t = randomToken();
  await app.db.query("INSERT INTO trusted_devices (token_hash, user_id, user_agent, expires_at) VALUES ($1,$2,$3, now() + make_interval(days => $4))", [sha256(t), userId, c.ua.slice(0, 300), days]);
  c.setCookie(DEVICE_COOKIE, t, { maxAge: 60 * 60 * 24 * days, sameSite: "Lax" });
}

export const forgetDevices = (db: Queryable, userId: string) => db.query("DELETE FROM trusted_devices WHERE user_id = $1", [userId]);

/** j***@example.com — enough to recognise the inbox without printing the address. */
export const maskEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_m, a, b, d) => a + "•".repeat(Math.min(Math.max(b.length, 2), 6)) + d);
