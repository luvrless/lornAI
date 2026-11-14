import type { App, Queryable } from "../../app.ts";
import { emails } from "../../lib/email-templates.ts";
import { PgError, asJson } from "../../db/pg.ts";
import { HttpError, badRequest, conflict, forbidden, unauthorized } from "../../lib/errors.ts";
import { hashPassword, verifyPassword, needsRehash, burnVerify } from "../../lib/password.ts";
import { randomToken, sha256, encrypt, decrypt, verifyTotp, base32Encode } from "../../lib/crypto.ts";
import { getSetting, queueEmail, securityEvent, notify } from "../platform/service.ts";
import type { AuthUser } from "../../lib/http.ts";
import crypto from "node:crypto";

// ------------------------------------------------------------------ usernames

const USERNAME_RE = /^[A-Za-z0-9_.]+$/;

export function usernameProblem(raw: string, min = 1, max = 12): string | null {
  const u = raw.trim();
  if (u.length < min) return `Username must be at least ${min} character${min === 1 ? "" : "s"}`;
  if (u.length > max) return `Username can be at most ${max} characters`;
  if (!USERNAME_RE.test(u)) return "Use only letters, numbers, underscores and dots";
  if (u.startsWith(".") || u.endsWith(".") || u.includes("..")) return "Dots can't be at the start, end, or doubled";
  return null;
}

export async function checkUsername(app: App, db: Queryable, raw: string, excludeUserId?: string) {
  const min = await getSetting<number>(app, "username.min_length", 1);
  const max = await getSetting<number>(app, "username.max_length", 12);
  const problem = usernameProblem(raw, Math.max(1, min), Math.min(12, max));
  if (problem) return { available: false, reason: problem };
  const lc = raw.trim().toLowerCase();
  const reserved = await db.query("SELECT 1 FROM reserved_usernames WHERE username_lc = $1", [lc]);
  if (reserved.rowCount) return { available: false, reason: "This username is reserved" };
  const taken = await db.query("SELECT 1 FROM users WHERE username_lc = $1 AND deleted_at IS NULL AND id IS DISTINCT FROM $2", [lc, excludeUserId ?? null]);
  if (taken.rowCount) return { available: false, reason: "This username is taken" };
  return { available: true, reason: null };
}

// ------------------------------------------------------------------ passwords

const COMMON = new Set(["password", "password1", "12345678", "123456789", "qwertyuiop", "iloveyou", "11111111", "lornlol123", "letmein123"]);

export function passwordProblem(pw: string, username?: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (Buffer.byteLength(pw) > 256) return "Password is too long";
  if (COMMON.has(pw.toLowerCase())) return "This password is too common";
  if (username && pw.toLowerCase() === username.toLowerCase()) return "Password can't be your username";
  return null;
}

// ------------------------------------------------------------------ users

const USER_COLS = "id, uid, username, email, email_verified_at, display_name, status, password_hash, totp_enabled_at, locked_until, failed_logins, created_at";

export function toAuthUser(r: any): AuthUser {
  return { id: r.id, uid: Number(r.uid), username: r.username, email: r.email, emailVerified: !!r.email_verified_at, displayName: r.display_name };
}

type RegistrationHook = (app: App, tx: Queryable, user: { id: string; uid: number }) => Promise<void>;
const registrationHooks: RegistrationHook[] = [];
/** Milestones/badges subscribe here; hooks run inside the registration transaction. */
export const onRegistered = (h: RegistrationHook) => registrationHooks.push(h);

export interface NewAccount {
  username: string;
  email: string | null;
  password: string | null;
  emailVerified?: boolean;
  oauth?: { provider: "discord" | "google"; providerUserId: string; username?: string | null; avatar?: string | null; email?: string | null };
}

export async function createAccount(app: App, input: NewAccount) {
  if (!(await getSetting<boolean>(app, "registration.enabled", true))) {
    throw new HttpError(403, "registration_closed", "Registration is currently closed");
  }
  const check = await checkUsername(app, app.db, input.username);
  if (!check.available) throw conflict(check.reason!, "username_unavailable");
  if (input.password) {
    const p = passwordProblem(input.password, input.username);
    if (p) throw badRequest(p);
  }
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const tosVersion = await getSetting<string>(app, "tos.version", "1");

  try {
    return await app.db.tx(async (tx) => {
      // Row-locked counter: gapless, strictly ordered, never reused.
      const { rows: [{ last: uid }] } = await tx.query<{ last: number }>("UPDATE uid_counter SET last = last + 1 RETURNING last");
      const { rows: [user] } = await tx.query(
        `INSERT INTO users (uid, username, email, email_verified_at, password_hash, tos_accepted_at, tos_version)
         VALUES ($1, $2, $3, $4, $5, now(), $6) RETURNING ${USER_COLS}`,
        [uid, input.username.trim(), input.email, input.emailVerified ? new Date() : null, passwordHash, tosVersion],
      );
      await tx.query("INSERT INTO username_history (user_id, old_username, new_username, reason) VALUES ($1, NULL, $2, 'registration')", [user.id, user.username]);
      await tx.query("INSERT INTO notification_prefs (user_id) VALUES ($1)", [user.id]);
      if (input.oauth) {
        await tx.query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_username, provider_avatar, email)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [user.id, input.oauth.provider, input.oauth.providerUserId, input.oauth.username ?? null, input.oauth.avatar ?? null, input.oauth.email ?? null],
        );
      }
      for (const h of registrationHooks) await h(app, tx, { id: user.id, uid: Number(user.uid) });
      return user;
    });
  } catch (e) {
    if (e instanceof PgError && e.code === "23505") {
      if (e.constraint === "users_username_live") throw conflict("This username is taken", "username_unavailable");
      if (e.constraint === "users_email_live") throw conflict("An account with this email already exists", "email_taken");
      if (e.constraint?.startsWith("oauth_accounts")) throw conflict("That external account is already linked to another LORN account", "oauth_taken");
    }
    throw e;
  }
}

export async function getUser(db: Queryable, id: string) {
  return (await db.query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id])).rows[0] ?? null;
}

// ------------------------------------------------------------------ sessions

export interface NewSession { token: string; id: string; csrf: string }

export async function createSession(app: App, db: Queryable, userId: string, method: string, ip: string, ua: string, mfaPending = false): Promise<{ token: string; id: string }> {
  const days = await getSetting<number>(app, "security.session_days", 30);
  const token = randomToken();
  const r = await db.query<{ id: string }>(
    `INSERT INTO sessions (token_hash, user_id, auth_method, mfa_pending, ip, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() + make_interval(days => $7)) RETURNING id`,
    [sha256(token), userId, method, mfaPending, ip, ua, days],
  );
  return { token, id: r.rows[0].id };
}

/** Resolve a cookie token to an active session + live, unbanned user. */
export async function resolveSessionToken(app: App, token: string) {
  const r = await app.db.query(
    `SELECT s.id AS sid, s.auth_method, s.mfa_pending, s.last_seen_at, u.*,
       EXISTS (SELECT 1 FROM account_bans b WHERE b.user_id = u.id AND b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > now())) AS banned,
       EXISTS (SELECT 1 FROM account_locks l WHERE l.user_id = u.id AND l.unlocked_at IS NULL) AS admin_locked
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.deleted_at IS NULL`,
    [sha256(token)],
  );
  const row = r.rows[0];
  if (!row || row.banned || row.admin_locked) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60_000) {
    app.db.query("UPDATE sessions SET last_seen_at = now() WHERE id = $1", [row.sid]).catch(() => {});
  }
  return { sessionId: row.sid as string, authMethod: row.auth_method as string, mfaPending: row.mfa_pending as boolean, user: toAuthUser(row) };
}

export async function revokeSession(db: Queryable, userId: string, sessionId: string, reason: string) {
  const r = await db.query("UPDATE sessions SET revoked_at = now(), revoked_reason = $3 WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL", [sessionId, userId, reason]);
  await db.query("UPDATE admin_sessions SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL", [sessionId]);
  return r.rowCount > 0;
}

export async function revokeAllSessions(db: Queryable, userId: string, reason: string, exceptSessionId?: string) {
  const r = await db.query(
    "UPDATE sessions SET revoked_at = now(), revoked_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL AND id IS DISTINCT FROM $3",
    [userId, reason, exceptSessionId ?? null],
  );
  await db.query("UPDATE admin_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND session_id IS DISTINCT FROM $2", [userId, exceptSessionId ?? null]);
  return r.rowCount;
}

export async function listSessions(db: Queryable, userId: string, currentId?: string) {
  const r = await db.query(
    `SELECT id, auth_method, ip::text, user_agent, created_at, last_seen_at, expires_at FROM sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC`, [userId]);
  return r.rows.map((s) => ({ ...s, current: s.id === currentId }));
}

// ------------------------------------------------------------------ login

export interface LoginResult { userId: string; session: { token: string; id: string }; mfaRequired: boolean; suspicious: boolean }

async function activeRestriction(db: Queryable, userId: string) {
  const ban = (await db.query(
    "SELECT reason, expires_at FROM account_bans WHERE user_id = $1 AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())", [userId])).rows[0];
  if (ban) return { code: "account_banned", message: ban.expires_at ? `This account is banned until ${new Date(ban.expires_at).toISOString()}` : "This account is permanently banned", reason: ban.reason };
  const lock = (await db.query("SELECT reason FROM account_locks WHERE user_id = $1 AND unlocked_at IS NULL", [userId])).rows[0];
  if (lock) return { code: "account_locked", message: "This account is locked. Contact support.", reason: lock.reason };
  return null;
}

/** Shared post-authentication checks for password and OAuth logins. */
export async function assertCanLogIn(app: App, userId: string) {
  if (!(await getSetting<boolean>(app, "login.enabled", true))) {
    throw new HttpError(403, "login_disabled", "Login is temporarily disabled");
  }
  const r = await activeRestriction(app.db, userId);
  if (r) throw new HttpError(403, r.code, r.message, { reason: r.reason });
}

function networkPrefix(ip: string) {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":");
  return ip.split(".").slice(0, 3).join(".");
}

function uaFamily(ua: string) {
  const b = /(Edg|OPR|Chrome|Firefox|Safari)\//.exec(ua)?.[1] ?? "other";
  const os = /(Windows|Mac OS X|Android|iPhone|iPad|Linux|CrOS)/.exec(ua)?.[1] ?? "other";
  return `${b}/${os}`;
}

export async function detectSuspicious(db: Queryable, userId: string, ip: string, ua: string) {
  const prev = (await db.query("SELECT ip::text, user_agent FROM login_history WHERE user_id = $1 AND success ORDER BY at DESC LIMIT 25", [userId])).rows;
  if (prev.length === 0) return false;
  const net = networkPrefix(ip), fam = uaFamily(ua);
  return !prev.some((p) => p.ip && networkPrefix(p.ip) === net) && !prev.some((p) => uaFamily(p.user_agent ?? "") === fam);
}

export async function recordLogin(app: App, userId: string, method: string, ip: string, ua: string) {
  const suspicious = await detectSuspicious(app.db, userId, ip, ua);
  await app.db.query("INSERT INTO login_history (user_id, method, success, suspicious, ip, user_agent) VALUES ($1,$2,true,$3,$4,$5)", [userId, method, suspicious, ip, ua]);
  await app.db.query("UPDATE users SET last_login_at = now(), failed_logins = 0, locked_until = NULL WHERE id = $1", [userId]);
  if (suspicious) {
    await securityEvent(app.db, userId, "login.new_device", "warning", { method, ua: uaFamily(ua) }, ip);
    await notify(app.db, userId, "security", "New sign-in to your account", `A sign-in from a new device or network (${uaFamily(ua)}) was detected. If this wasn't you, change your password and revoke sessions.`);
    const u = await getUser(app.db, userId);
    if (u?.email) {
      await queueEmail(app, app.db, { to: u.email, userId, ...emails.newSignIn(app.cfg.appUrl, { username: u.username, device: uaFamily(ua).replace("/", " on "), ip, at: app.now() }) });
    }
  }
  return suspicious;
}

export async function login(app: App, identifier: string, password: string, ip: string, ua: string): Promise<LoginResult> {
  const id = identifier.trim();
  const user = (await app.db.query(
    `SELECT ${USER_COLS} FROM users WHERE deleted_at IS NULL AND (${id.includes("@") ? "email = $1" : "username_lc = lower($1)"})`, [id])).rows[0];

  const fail = async (reason: string, userId: string | null) => {
    await app.db.query("INSERT INTO login_history (user_id, identifier, method, success, failure_reason, ip, user_agent) VALUES ($1,$2,'password',false,$3,$4,$5)", [userId, id.slice(0, 254), reason, ip, ua]);
  };

  if (!user || !user.password_hash) {
    await burnVerify(password); // equal timing whether or not the account exists
    await fail(user ? "no_password" : "unknown_user", user?.id ?? null);
    throw new HttpError(401, "invalid_credentials", "Incorrect username/email or password");
  }

  if (user.locked_until && new Date(user.locked_until) > app.now()) {
    await fail("temporarily_locked", user.id);
    throw new HttpError(423, "temporarily_locked", "Too many failed attempts. Try again later.", { until: user.locked_until });
  }

  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) {
    const max = await getSetting<number>(app, "security.max_failed_logins", 8);
    const minutes = await getSetting<number>(app, "security.lockout_minutes", 15);
    const r = await app.db.query<{ failed_logins: number }>(
      `UPDATE users SET failed_logins = failed_logins + 1,
         locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
       WHERE id = $1 RETURNING failed_logins`, [user.id, max, minutes]);
    await fail("bad_password", user.id);
    if (r.rows[0].failed_logins >= max) {
      await securityEvent(app.db, user.id, "login.lockout", "warning", { attempts: r.rows[0].failed_logins }, ip);
    }
    throw new HttpError(401, "invalid_credentials", "Incorrect username/email or password");
  }

  await assertCanLogIn(app, user.id);
  if (await getSetting<boolean>(app, "security.require_email_verification_for_login", false) && !user.email_verified_at) {
    throw new HttpError(403, "email_unverified", "Verify your email before signing in");
  }

  if (needsRehash(user.password_hash)) {
    const h = await hashPassword(password);
    await app.db.query("UPDATE users SET password_hash = $2 WHERE id = $1", [user.id, h]);
  }

  const mfa = !!user.totp_enabled_at;
  const session = await createSession(app, app.db, user.id, "password", ip, ua, mfa);
  const suspicious = await recordLogin(app, user.id, "password", ip, ua);
  return { userId: user.id, session, mfaRequired: mfa, suspicious };
}

// ------------------------------------------------------------------ 2FA

export async function beginTotpSetup(app: App, userId: string) {
  const u = await getUser(app.db, userId);
  if (u.totp_enabled_at) throw conflict("Two-factor authentication is already enabled");
  const secret = crypto.randomBytes(20);
  await app.db.query("UPDATE users SET totp_secret_enc = $2 WHERE id = $1", [userId, encrypt(app.cfg.encryptionKey, secret.toString("hex"))]);
  const b32 = base32Encode(secret);
  return { secret: b32, otpauthUrl: `otpauth://totp/LORN.LOL:${encodeURIComponent(u.username)}?secret=${b32}&issuer=LORN.LOL&digits=6&period=30` };
}

async function loadTotp(app: App, userId: string): Promise<Buffer | null> {
  const r = (await app.db.query("SELECT totp_secret_enc FROM users WHERE id = $1", [userId])).rows[0];
  if (!r?.totp_secret_enc) return null;
  return Buffer.from(decrypt(app.cfg.encryptionKey, r.totp_secret_enc), "hex");
}

function newRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const s = crypto.randomBytes(5).toString("hex");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export async function enableTotp(app: App, userId: string, code: string) {
  const secret = await loadTotp(app, userId);
  if (!secret) throw badRequest("Start two-factor setup first");
  if (!verifyTotp(secret, code)) throw new HttpError(400, "invalid_code", "That code is not valid");
  const codes = newRecoveryCodes();
  await app.db.tx(async (tx) => {
    const r = await tx.query("UPDATE users SET totp_enabled_at = now() WHERE id = $1 AND totp_enabled_at IS NULL", [userId]);
    if (!r.rowCount) throw conflict("Two-factor authentication is already enabled");
    await tx.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
    for (const c of codes) await tx.query("INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1,$2)", [userId, sha256(c)]);
    await securityEvent(tx, userId, "mfa.enabled", "info", {});
  });
  return { recoveryCodes: codes };
}

export async function checkSecondFactor(app: App, userId: string, code: string): Promise<"totp" | "recovery" | null> {
  const secret = await loadTotp(app, userId);
  if (secret && verifyTotp(secret, code.trim())) return "totp";
  const r = await app.db.query("UPDATE recovery_codes SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL", [userId, sha256(code.trim().toLowerCase())]);
  return r.rowCount ? "recovery" : null;
}

export async function completeMfa(app: App, sessionId: string, userId: string, code: string, ip: string) {
  const how = await checkSecondFactor(app, userId, code);
  if (!how) {
    await securityEvent(app.db, userId, "mfa.failed", "warning", {}, ip);
    throw new HttpError(400, "invalid_code", "That code is not valid");
  }
  await app.db.query("UPDATE sessions SET mfa_pending = false WHERE id = $1 AND user_id = $2", [sessionId, userId]);
  if (how === "recovery") await securityEvent(app.db, userId, "mfa.recovery_code_used", "warning", {}, ip);
}

export async function disableTotp(app: App, userId: string, password: string | null, code: string) {
  const u = await getUser(app.db, userId);
  if (!u.totp_enabled_at) throw badRequest("Two-factor authentication is not enabled");
  if (u.password_hash && !(password && (await verifyPassword(u.password_hash, password)))) throw new HttpError(400, "invalid_password", "Password is incorrect");
  if (!(await checkSecondFactor(app, userId, code))) throw new HttpError(400, "invalid_code", "That code is not valid");
  await app.db.query("UPDATE users SET totp_secret_enc = NULL, totp_enabled_at = NULL WHERE id = $1", [userId]);
  await app.db.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
  await securityEvent(app.db, userId, "mfa.disabled", "warning", {});
}

export async function regenerateRecoveryCodes(app: App, userId: string, code: string) {
  if ((await checkSecondFactor(app, userId, code)) !== "totp") throw new HttpError(400, "invalid_code", "Enter a code from your authenticator app");
  const codes = newRecoveryCodes();
  await app.db.tx(async (tx) => {
    await tx.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
    for (const c of codes) await tx.query("INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1,$2)", [userId, sha256(c)]);
  });
  return { recoveryCodes: codes };
}

// ------------------------------------------------------------------ email tokens

type Purpose = "verify_email" | "reset_password" | "change_email";
const TTL_MIN: Record<Purpose, number> = { verify_email: 24 * 60, reset_password: 60, change_email: 24 * 60 };

export async function issueToken(db: Queryable, userId: string, purpose: Purpose, data: object = {}, createdBy?: string) {
  const token = randomToken();
  // Only the newest token of each purpose stays valid.
  await db.query("UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL", [userId, purpose]);
  await db.query(
    "INSERT INTO auth_tokens (token_hash, user_id, purpose, data, expires_at, created_by) VALUES ($1,$2,$3,$4, now() + make_interval(mins => $5), $6)",
    [sha256(token), userId, purpose, asJson(data), TTL_MIN[purpose], createdBy ?? null],
  );
  return token;
}

/** Atomically consume a token; returns its row or throws. */
export async function consumeToken(db: Queryable, token: string, purpose: Purpose) {
  const r = await db.query(
    `UPDATE auth_tokens SET used_at = now()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id, data`, [sha256(token), purpose]);
  if (!r.rowCount) throw new HttpError(400, "invalid_token", "This link is invalid or has expired");
  return r.rows[0] as { user_id: string; data: any };
}

export async function sendVerificationEmail(app: App, userId: string) {
  const u = await getUser(app.db, userId);
  if (!u.email) throw badRequest("Add an email address first");
  if (u.email_verified_at) return { alreadyVerified: true, status: "verified" };
  const token = await issueToken(app.db, userId, "verify_email");
  const m = await queueEmail(app, app.db, { to: u.email, userId, ...emails.verifyEmail(app.cfg.appUrl, { username: u.username, url: `${app.cfg.appUrl}/verify-email?token=${token}` }) });
  return { alreadyVerified: false, status: m.status };
}

export async function verifyEmail(app: App, token: string) {
  return app.db.tx(async (tx) => {
    const t = await consumeToken(tx, token, "verify_email");
    await tx.query("UPDATE users SET email_verified_at = now() WHERE id = $1", [t.user_id]);
    return { userId: t.user_id };
  });
}

export async function requestPasswordReset(app: App, identifier: string, ip: string, createdBy?: string) {
  const id = identifier.trim();
  const u = (await app.db.query(
    `SELECT id, username, email FROM users WHERE deleted_at IS NULL AND (${id.includes("@") ? "email = $1" : "username_lc = lower($1)"})`, [id])).rows[0];
  // Same response whether or not the account exists.
  if (!u?.email) return { status: "accepted" };
  const lim = app.limiter.take(`reset:${u.id}`, { capacity: 3, refillPerSec: 3 / 3600 });
  if (!lim.ok && !createdBy) return { status: "accepted" };
  const token = await issueToken(app.db, u.id, "reset_password", {}, createdBy);
  const m = await queueEmail(app, app.db, { to: u.email, userId: u.id, ...emails.resetPassword(app.cfg.appUrl, { username: u.username, url: `${app.cfg.appUrl}/reset-password?token=${token}`, byStaff: !!createdBy }) });
  await securityEvent(app.db, u.id, createdBy ? "password.reset_initiated_by_staff" : "password.reset_requested", "info", { by: createdBy ?? null }, ip);
  return { status: "accepted", emailStatus: m.status };
}

export async function resetPassword(app: App, token: string, newPassword: string, ip: string) {
  const hash = await hashPassword(newPassword);
  return app.db.tx(async (tx) => {
    const t = await consumeToken(tx, token, "reset_password");
    const u = await getUser(tx, t.user_id);
    const p = passwordProblem(newPassword, u.username);
    if (p) throw badRequest(p);
    await tx.query("UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL WHERE id = $1", [u.id, hash]);
    await revokeAllSessions(tx, u.id, "password_reset");
    await securityEvent(tx, u.id, "password.reset", "warning", {}, ip);
    return { userId: u.id };
  });
}

export async function changePassword(app: App, userId: string, sessionId: string, current: string | null, next: string, ip: string) {
  const u = await getUser(app.db, userId);
  if (u.password_hash) {
    if (!current || !(await verifyPassword(u.password_hash, current))) throw new HttpError(400, "invalid_password", "Current password is incorrect");
  }
  const p = passwordProblem(next, u.username);
  if (p) throw badRequest(p);
  const hash = await hashPassword(next);
  await app.db.tx(async (tx) => {
    await tx.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, hash]);
    await revokeAllSessions(tx, userId, "password_changed", sessionId);
    await securityEvent(tx, userId, u.password_hash ? "password.changed" : "password.set", "info", {}, ip);
  });
}

export async function requestEmailChange(app: App, userId: string, password: string | null, newEmail: string) {
  const u = await getUser(app.db, userId);
  if (u.password_hash && !(password && (await verifyPassword(u.password_hash, password)))) throw new HttpError(400, "invalid_password", "Password is incorrect");
  const taken = await app.db.query("SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL AND id <> $2", [newEmail, userId]);
  if (taken.rowCount) throw conflict("An account with this email already exists", "email_taken");
  const token = await issueToken(app.db, userId, "change_email", { email: newEmail });
  const m = await queueEmail(app, app.db, { to: newEmail, userId, ...emails.changeEmail(app.cfg.appUrl, { username: u.username, newEmail, url: `${app.cfg.appUrl}/verify-email?change=1&token=${token}` }) });
  return { status: m.status };
}

export async function confirmEmailChange(app: App, token: string) {
  try {
    return await app.db.tx(async (tx) => {
      const t = await consumeToken(tx, token, "change_email");
      const old = await getUser(tx, t.user_id);
      await tx.query("UPDATE users SET email = $2, email_verified_at = now() WHERE id = $1", [t.user_id, t.data.email]);
      await securityEvent(tx, t.user_id, "email.changed", "warning", { from: old.email, to: t.data.email });
      if (old.email) {
        await queueEmail(app, tx, { to: old.email, userId: t.user_id, ...emails.emailChanged(app.cfg.appUrl, { username: old.username, newEmail: t.data.email }) });
      }
      return { userId: t.user_id };
    });
  } catch (e) {
    if (e instanceof PgError && e.code === "23505") throw conflict("An account with this email already exists", "email_taken");
    throw e;
  }
}

// ------------------------------------------------------------------ deletion

/**
 * Soft-delete: PII is scrubbed, credentials and links removed, sessions
 * revoked. The row (and its UID) is kept forever so UIDs are never reused
 * and registration order is preserved.
 */
export async function deleteAccount(app: App, userId: string, opts: { password?: string | null; confirmUsername: string; byAdmin?: boolean }) {
  const u = await getUser(app.db, userId);
  if (!u || u.status === "deleted") throw badRequest("Account already deleted");
  if (!opts.byAdmin) {
    if (opts.confirmUsername.toLowerCase() !== u.username.toLowerCase()) throw badRequest("Type your username to confirm");
    if (u.password_hash && !(opts.password && (await verifyPassword(u.password_hash, opts.password)))) throw new HttpError(400, "invalid_password", "Password is incorrect");
  }
  await app.db.tx(async (tx) => {
    await revokeAllSessions(tx, userId, "account_deleted");
    await tx.query("DELETE FROM oauth_accounts WHERE user_id = $1", [userId]);
    await tx.query("UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [userId]);
    await tx.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
    await tx.query(
      `UPDATE users SET status = 'deleted', deleted_at = now(), email = NULL, password_hash = NULL,
         display_name = NULL, totp_secret_enc = NULL, totp_enabled_at = NULL WHERE id = $1`, [userId]);
    await securityEvent(tx, userId, "account.deleted", "warning", { byAdmin: !!opts.byAdmin });
  });
}

export async function loginHistory(db: Queryable, userId: string, limit = 50) {
  return (await db.query(
    "SELECT method, success, failure_reason, suspicious, ip::text, user_agent, at FROM login_history WHERE user_id = $1 ORDER BY at DESC LIMIT $2", [userId, limit])).rows;
}

export { unauthorized, forbidden };
