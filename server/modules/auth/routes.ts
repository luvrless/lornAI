import type { App } from "../../app.ts";
import { Router, z, type Ctx } from "../../lib/http.ts";
import { RULES } from "../../lib/ratelimit.ts";
import { HttpError } from "../../lib/errors.ts";
import * as auth from "./service.ts";
import * as oauth from "./oauth.ts";
import { csrfFor, setSessionCookie, clearSessionCookie } from "./cookies.ts";
import { isOwnerDiscordId, roleForDiscordId } from "../authz/service.ts";
import { getSetting } from "../platform/service.ts";

const username = z.string().trim().min(1).max(12);
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(1).max(256);
const provider = z.enum(["discord", "google"]);

export function authRoutes(app: App, r: Router) {
  const me = async (c: any) => {
    const u = c.user!;
    const links = (await app.db.query("SELECT provider, provider_user_id, provider_username, provider_avatar, linked_at FROM oauth_accounts WHERE user_id = $1", [u.id])).rows;
    const row = (await app.db.query("SELECT created_at, totp_enabled_at, password_hash IS NOT NULL AS has_password FROM users WHERE id = $1", [u.id])).rows[0];
    const discord = links.find((l) => l.provider === "discord");
    const staff = discord ? await roleForDiscordId(app, app.db, discord.provider_user_id) : null;
    return {
      user: { ...u, createdAt: row.created_at, hasPassword: row.has_password, twoFactor: !!row.totp_enabled_at },
      connections: links.map((l) => ({ provider: l.provider, providerUserId: l.provider_user_id, username: l.provider_username, avatar: l.provider_avatar, linkedAt: l.linked_at })),
      // The admin panel link is shown only to the owner and owner-appointed admins.
      // Staff (and everyone else) get no hint that the panel exists.
      adminPanel: staff?.role === "OWNER" || staff?.role === "ADMIN",
      staffRole: staff?.role === "OWNER" || staff?.role === "ADMIN" ? staff.role : null,
      mfaPending: c.session.mfaPending,
      csrf: c.session.csrf,
    };
  };

  r.get("/api/auth/me", async (c) => {
    if (!c.user || !c.session) return { user: null };
    return me(c);
  }, { allowMfaPending: true, maintenanceExempt: true });

  r.get("/api/auth/providers", async () => ({
    discord: !!app.cfg.discord, google: !!app.cfg.google,
    registration: await getSetting(app, "registration.enabled", true),
  }), { maintenanceExempt: true });

  r.get("/api/auth/username/:name", async (c) => auth.checkUsername(app, app.db, c.params.name),
    { rate: { name: "uname", rule: RULES.usernameCheck } });

  r.post("/api/auth/register", async (c) => {
    const b = await c.body(z.object({ username, email, password, acceptTos: z.literal(true, { message: "You must accept the Terms of Service" }) }));
    const user = await auth.createAccount(app, { username: b.username, email: b.email, password: b.password });
    const s = await auth.createSession(app, app.db, user.id, "password", c.ip, c.ua);
    await auth.recordLogin(app, user.id, "password", c.ip, c.ua);
    setSessionCookie(app, c, s.token);
    const v = await auth.sendVerificationEmail(app, user.id);
    return { user: auth.toAuthUser(user), csrf: csrfFor(app, s.id), verificationEmail: v.status };
  }, { rate: { name: "register", rule: RULES.register } });

  r.post("/api/auth/login", async (c) => {
    const b = await c.body(z.object({ identifier: z.string().trim().min(1).max(254), password }));
    const res = await auth.login(app, b.identifier, b.password, c.ip, c.ua);
    setSessionCookie(app, c, res.session.token);
    return { mfaRequired: res.mfaRequired, csrf: csrfFor(app, res.session.id) };
  }, { rate: { name: "login", rule: RULES.auth }, maintenanceExempt: true });

  r.post("/api/auth/2fa/verify", async (c) => {
    const b = await c.body(z.object({ code: z.string().trim().min(6).max(16) }));
    if (!c.session!.mfaPending) return { ok: true };
    await auth.completeMfa(app, c.session!.id, c.user!.id, b.code, c.ip);
    return { ok: true };
  }, { auth: "required", allowMfaPending: true, rate: { name: "mfa", rule: RULES.auth, by: "user" }, maintenanceExempt: true });

  r.post("/api/auth/logout", async (c) => {
    if (c.session) await auth.revokeSession(app.db, c.user!.id, c.session.id, "logout");
    clearSessionCookie(c);
  }, { allowMfaPending: true, maintenanceExempt: true });

  r.post("/api/auth/verify-email", async (c) => {
    const b = await c.body(z.object({ token: z.string().min(10).max(200), change: z.boolean().optional() }));
    return b.change ? auth.confirmEmailChange(app, b.token).then(() => ({ ok: true })) : auth.verifyEmail(app, b.token).then(() => ({ ok: true }));
  }, { rate: { name: "token", rule: RULES.auth } });

  r.post("/api/auth/resend-verification", async (c) => auth.sendVerificationEmail(app, c.user!.id),
    { auth: "required", rate: { name: "verifymail", rule: RULES.emailSend, by: "user" } });

  r.post("/api/auth/forgot-password", async (c) => {
    const b = await c.body(z.object({ identifier: z.string().trim().min(1).max(254) }));
    const res = await auth.requestPasswordReset(app, b.identifier, c.ip);
    return { status: res.status };
  }, { rate: { name: "forgot", rule: RULES.auth } });

  r.post("/api/auth/reset-password", async (c) => {
    const b = await c.body(z.object({ token: z.string().min(10).max(200), password }));
    await auth.resetPassword(app, b.token, b.password, c.ip);
    return { ok: true };
  }, { rate: { name: "token", rule: RULES.auth } });

  // ------------------------------------------------------------ OAuth
  r.get("/api/auth/:provider/start", async (c) => {
    const p = provider.safeParse(c.params.provider);
    if (!p.success) throw new HttpError(404, "not_found", "Unknown provider");
    const intent = (["login", "link", "admin"].includes(c.query.intent) ? c.query.intent : "login") as oauth.Intent;
    c.redirect(await oauth.startOAuth(app, c, p.data, intent, c.query.next));
  }, { rate: { name: "oauth", rule: RULES.auth }, maintenanceExempt: true });

  const callback = async (c: Ctx) => {
    const p = provider.safeParse(c.params.provider);
    if (!p.success) throw new HttpError(404, "not_found", "Unknown provider");
    c.redirect(await oauth.handleCallback(app, c, p.data));
  };
  r.get("/api/auth/:provider/callback", callback, { skipCsrf: true, maintenanceExempt: true });
  r.get("/api/auth/callback/:provider", callback, { skipCsrf: true, maintenanceExempt: true });

  r.get("/api/auth/signup/pending", async (c) => {
    const p = await oauth.pendingSignup(app, c);
    return p ? { provider: p.provider, suggestedUsername: p.username, avatar: p.avatar } : { provider: null };
  });

  r.post("/api/auth/signup/complete", async (c) => {
    const b = await c.body(z.object({ username, acceptTos: z.literal(true, { message: "You must accept the Terms of Service" }) }));
    const res = await oauth.completeSignup(app, c, b.username);
    return { user: auth.toAuthUser(res.user), isOwner: res.isOwner };
  }, { rate: { name: "register", rule: RULES.register } });

  // ------------------------------------------------------------ account
  r.get("/api/account/sessions", async (c) => auth.listSessions(app.db, c.user!.id, c.session!.id), { auth: "required" });

  r.delete("/api/account/sessions/:id", async (c) => {
    const ok = await auth.revokeSession(app.db, c.user!.id, c.params.id, "user_revoked");
    if (!ok) throw new HttpError(404, "not_found", "Session not found");
    if (c.params.id === c.session!.id) clearSessionCookie(c);
  }, { auth: "required" });

  r.post("/api/account/sessions/revoke-others", async (c) => ({ revoked: await auth.revokeAllSessions(app.db, c.user!.id, "user_revoked_all", c.session!.id) }), { auth: "required" });

  r.get("/api/account/login-history", async (c) => auth.loginHistory(app.db, c.user!.id), { auth: "required" });

  r.get("/api/account/security-events", async (c) =>
    (await app.db.query("SELECT kind, severity, data, ip::text, at FROM security_events WHERE user_id = $1 ORDER BY at DESC LIMIT 50", [c.user!.id])).rows,
    { auth: "required" });

  r.post("/api/account/password", async (c) => {
    const b = await c.body(z.object({ current: z.string().max(256).nullable().optional(), next: password }));
    await auth.changePassword(app, c.user!.id, c.session!.id, b.current ?? null, b.next, c.ip);
    return { ok: true };
  }, { auth: "required", rate: { name: "pwchange", rule: RULES.auth, by: "user" } });

  r.post("/api/account/email", async (c) => {
    const b = await c.body(z.object({ email, password: z.string().max(256).nullable().optional() }));
    return auth.requestEmailChange(app, c.user!.id, b.password ?? null, b.email);
  }, { auth: "required", rate: { name: "emailchange", rule: RULES.emailSend, by: "user" } });

  r.post("/api/account/2fa/setup", async (c) => auth.beginTotpSetup(app, c.user!.id), { auth: "required" });
  r.post("/api/account/2fa/enable", async (c) => {
    const b = await c.body(z.object({ code: z.string().trim().length(6) }));
    return auth.enableTotp(app, c.user!.id, b.code);
  }, { auth: "required", rate: { name: "mfa", rule: RULES.auth, by: "user" } });
  r.post("/api/account/2fa/disable", async (c) => {
    const b = await c.body(z.object({ password: z.string().max(256).nullable().optional(), code: z.string().trim().min(6).max(16) }));
    await auth.disableTotp(app, c.user!.id, b.password ?? null, b.code);
    return { ok: true };
  }, { auth: "required", rate: { name: "mfa", rule: RULES.auth, by: "user" } });
  r.post("/api/account/2fa/recovery-codes", async (c) => {
    const b = await c.body(z.object({ code: z.string().trim().length(6) }));
    return auth.regenerateRecoveryCodes(app, c.user!.id, b.code);
  }, { auth: "required", rate: { name: "mfa", rule: RULES.auth, by: "user" } });

  r.delete("/api/account/connections/:provider", async (c) => {
    const p = provider.parse(c.params.provider);
    await oauth.unlinkProvider(app, c.user!.id, p, c.ip);
  }, { auth: "required" });

  r.post("/api/account/delete", async (c) => {
    const b = await c.body(z.object({ confirmUsername: z.string().min(1).max(12), password: z.string().max(256).nullable().optional() }));
    if (await isOwnerOf(app, c.user!.id)) throw new HttpError(403, "forbidden", "The platform owner account cannot be deleted from the dashboard");
    await auth.deleteAccount(app, c.user!.id, { password: b.password ?? null, confirmUsername: b.confirmUsername });
    clearSessionCookie(c);
    return { ok: true };
  }, { auth: "required", rate: { name: "delete", rule: RULES.auth, by: "user" } });

  r.get("/api/account/notifications", async (c) =>
    (await app.db.query("SELECT id, kind, title, body, data, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100", [c.user!.id])).rows,
    { auth: "required" });

  r.post("/api/account/notifications/read", async (c) => {
    const b = await c.body(z.object({ ids: z.array(z.number().int()).max(200).optional() }));
    await app.db.query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL AND ($2::bigint[] IS NULL OR id = ANY($2::bigint[]))", [c.user!.id, b.ids ?? null]);
  }, { auth: "required" });

  r.get("/api/account/notification-prefs", async (c) =>
    (await app.db.query("SELECT email_security, email_product, inapp_all FROM notification_prefs WHERE user_id = $1", [c.user!.id])).rows[0],
    { auth: "required" });

  r.patch("/api/account/notification-prefs", async (c) => {
    const b = await c.body(z.object({ emailSecurity: z.boolean().optional(), emailProduct: z.boolean().optional(), inappAll: z.boolean().optional() }));
    const r2 = await app.db.query(
      `UPDATE notification_prefs SET email_security = COALESCE($2, email_security), email_product = COALESCE($3, email_product), inapp_all = COALESCE($4, inapp_all)
       WHERE user_id = $1 RETURNING email_security, email_product, inapp_all`,
      [c.user!.id, b.emailSecurity ?? null, b.emailProduct ?? null, b.inappAll ?? null]);
    return r2.rows[0];
  }, { auth: "required" });
}

async function isOwnerOf(app: App, userId: string) {
  const d = (await app.db.query("SELECT provider_user_id FROM oauth_accounts WHERE user_id = $1 AND provider = 'discord'", [userId])).rows[0];
  return isOwnerDiscordId(app, d?.provider_user_id);
}
