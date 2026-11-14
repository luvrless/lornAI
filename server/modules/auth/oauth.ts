/**
 * Discord (and Google) OAuth2. Codes are exchanged server-side, identities are
 * matched by the provider's immutable user ID, and secrets/tokens never reach
 * the browser. State is single-use, expires in 10 minutes, and is bound to the
 * initiating browser by an HttpOnly cookie.
 */
import crypto from "node:crypto";
import type { App } from "../../app.ts";
import type { Ctx } from "../../lib/http.ts";
import { HttpError, unavailable } from "../../lib/errors.ts";
import { randomToken, sha256, encrypt, safeEqual } from "../../lib/crypto.ts";
import { audit, isFlagEnabled, securityEvent } from "../platform/service.ts";
import { assertCanLogIn, createSession, recordLogin, createAccount } from "./service.ts";
import { createAdminSession, roleForDiscordId, isOwnerDiscordId } from "../authz/service.ts";
import { SESSION_COOKIE, setSessionCookie } from "./cookies.ts";

export type Provider = "discord" | "google";
export type Intent = "login" | "link" | "admin";

const STATE_COOKIE = "lorn_oauth";
const SIGNUP_COOKIE = "lorn_signup";

function providerCfg(app: App, p: Provider) {
  const c = p === "discord" ? app.cfg.discord : app.cfg.google;
  if (!c) throw unavailable(`${p === "discord" ? "Discord" : "Google"} sign-in is not configured on this server`, "oauth_not_configured");
  return c;
}

/** OAUTH_CALLBACK_PATH lets a deployment keep the redirect URL its OAuth apps already allow (e.g. NextAuth-style "/api/auth/callback/{provider}"). */
const redirectUri = (app: App, p: Provider) => `${app.cfg.appUrl}${(process.env.OAUTH_CALLBACK_PATH ?? "/api/auth/{provider}/callback").replace("{provider}", p)}`;

function safeRedirect(path: unknown): string | null {
  return typeof path === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(path) ? path : null;
}

export async function startOAuth(app: App, c: Ctx, p: Provider, intent: Intent, redirectTo?: string) {
  const cfg = providerCfg(app, p);
  if ((intent === "link") && !c.user) throw new HttpError(401, "unauthorized", "Sign in first");
  const state = randomToken();
  const verifier = p === "google" ? randomToken(48) : "";
  await app.db.query(
    `INSERT INTO oauth_states (state_hash, provider, intent, user_id, code_verifier, redirect_to, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() + interval '10 minutes')`,
    [sha256(state), p, intent, c.user?.id ?? null, verifier, safeRedirect(redirectTo)]);
  c.setCookie(STATE_COOKIE, state, { maxAge: 600, sameSite: "Lax", path: `/api/auth/${p}` });

  const q = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: redirectUri(app, p), response_type: "code", state });
  if (p === "discord") {
    q.set("scope", "identify");
    q.set("prompt", intent === "admin" ? "consent" : "none");
  } else {
    q.set("scope", "openid email profile");
    q.set("code_challenge", crypto.createHash("sha256").update(verifier).digest("base64url"));
    q.set("code_challenge_method", "S256");
  }
  return `${cfg.authorizeUrl}?${q}`;
}

interface Identity { id: string; username: string | null; avatar: string | null; email: string | null; emailVerified: boolean; accessToken: string; refreshToken: string | null; expiresIn: number | null; scopes: string[] }

async function exchange(app: App, p: Provider, code: string, verifier: string): Promise<Identity> {
  const cfg = providerCfg(app, p);
  const form = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(app, p) });
  if (verifier) form.set("code_verifier", verifier);
  const tokenUrl = p === "discord" ? `${app.cfg.discord!.apiBase}/oauth2/token` : app.cfg.google!.tokenUrl;
  const tr = await app.fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64") },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!tr.ok) throw new HttpError(502, "oauth_exchange_failed", `${p} rejected the authorization code (${tr.status})`);
  const tok = await tr.json() as any;
  if (!tok.access_token) throw new HttpError(502, "oauth_exchange_failed", "No access token returned");

  const meUrl = p === "discord" ? `${app.cfg.discord!.apiBase}/users/@me` : app.cfg.google!.userinfoUrl;
  const mr = await app.fetch(meUrl, { headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(10_000) });
  if (!mr.ok) throw new HttpError(502, "oauth_profile_failed", `Could not read your ${p} account (${mr.status})`);
  const me = await mr.json() as any;

  if (p === "discord") {
    if (typeof me.id !== "string" || !/^\d{17,20}$/.test(me.id)) throw new HttpError(502, "oauth_profile_failed", "Discord returned an invalid user");
    return {
      id: me.id, username: me.username ?? null,
      avatar: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png` : null,
      email: me.email ?? null, emailVerified: !!me.verified, accessToken: tok.access_token, refreshToken: tok.refresh_token ?? null,
      expiresIn: tok.expires_in ?? null, scopes: String(tok.scope ?? "").split(" ").filter(Boolean),
    };
  }
  if (typeof me.sub !== "string") throw new HttpError(502, "oauth_profile_failed", "Google returned an invalid user");
  return {
    id: me.sub, username: me.name ?? null, avatar: me.picture ?? null, email: me.email ?? null, emailVerified: !!me.email_verified,
    accessToken: tok.access_token, refreshToken: tok.refresh_token ?? null, expiresIn: tok.expires_in ?? null, scopes: String(tok.scope ?? "").split(" ").filter(Boolean),
  };
}

async function storeTokens(app: App, userId: string, p: Provider, idn: Identity) {
  await app.db.query(
    `UPDATE oauth_accounts SET provider_username = $3, provider_avatar = $4, access_token_enc = $5, refresh_token_enc = $6,
       token_expires_at = CASE WHEN $7::int IS NULL THEN NULL ELSE now() + make_interval(secs => $7::int) END, scopes = $8, updated_at = now()
     WHERE user_id = $1 AND provider = $2`,
    [userId, p, idn.username, idn.avatar, encrypt(app.cfg.encryptionKey, idn.accessToken),
     idn.refreshToken ? encrypt(app.cfg.encryptionKey, idn.refreshToken) : null, idn.expiresIn, idn.scopes]);
}

/** Returns the path to redirect the browser to. */
export async function handleCallback(app: App, c: Ctx, p: Provider): Promise<string> {
  const fail = (code: string) => `/login?error=${code}`;
  const { code, state, error } = c.query;
  c.clearCookie(STATE_COOKIE, { path: `/api/auth/${p}` });
  if (error) return fail("oauth_denied");
  if (!code || !state) return fail("oauth_invalid");
  const cookieState = c.cookies[STATE_COOKIE];
  if (!cookieState || !safeEqual(cookieState, state)) return fail("oauth_state_mismatch");

  const st = (await app.db.query(
    "DELETE FROM oauth_states WHERE state_hash = $1 AND provider = $2 RETURNING intent, user_id, code_verifier, redirect_to, expires_at",
    [sha256(state), p])).rows[0];
  if (!st || new Date(st.expires_at) < app.now()) return fail("oauth_state_expired");

  let idn: Identity;
  try { idn = await exchange(app, p, code, st.code_verifier); }
  catch (e) {
    app.log.warn("oauth exchange failed", { provider: p, err: (e as Error).message });
    return fail("oauth_exchange_failed");
  }

  const linked = (await app.db.query(
    `SELECT o.user_id FROM oauth_accounts o JOIN users u ON u.id = o.user_id
     WHERE o.provider = $1 AND o.provider_user_id = $2 AND u.deleted_at IS NULL`, [p, idn.id])).rows[0] as { user_id: string } | undefined;

  // ---------------------------------------------------------------- link
  if (st.intent === "link") {
    if (!c.user || c.user.id !== st.user_id) return fail("oauth_session_changed");
    if (linked && linked.user_id !== c.user.id) return "/dashboard/account?link_error=already_linked";
    if (!linked) {
      const has = await app.db.query("SELECT 1 FROM oauth_accounts WHERE user_id = $1 AND provider = $2", [c.user.id, p]);
      if (has.rowCount) return "/dashboard/account?link_error=provider_already_linked";
      await app.db.query("INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_username, provider_avatar, email) VALUES ($1,$2,$3,$4,$5,$6)",
        [c.user.id, p, idn.id, idn.username, idn.avatar, idn.email]);
      await securityEvent(app.db, c.user.id, "oauth.linked", "info", { provider: p }, c.ip);
    }
    await storeTokens(app, c.user.id, p, idn);
    return `/dashboard/account?linked=${p}`;
  }

  // ---------------------------------------------------------------- admin
  if (st.intent === "admin") {
    if (p !== "discord") return fail("oauth_invalid");
    const role = await roleForDiscordId(app, app.db, idn.id);
    if (!role) {
      await securityEvent(app.db, linked?.user_id ?? c.user?.id ?? null, "admin.access_denied", "warning", { discordId: idn.id }, c.ip);
      return "/admin/denied";
    }
    let userId = c.user?.id ?? null;
    let sessionId = c.session?.id ?? null;
    if (userId && linked && linked.user_id !== userId) return "/admin/denied?reason=account_mismatch";
    if (!userId) {
      if (!linked) {
        // Authorized Discord account with no LORN account yet: sign up first.
        await beginSignup(app, c, p, idn);
        return "/signup/complete?next=/admin";
      }
      try { await assertCanLogIn(app, linked.user_id); } catch { return fail("account_restricted"); }
      const s = await createSession(app, app.db, linked.user_id, "discord", c.ip, c.ua, await hasMfa(app, linked.user_id));
      await recordLogin(app, linked.user_id, "discord", c.ip, c.ua);
      setSessionCookie(app, c, s.token);
      userId = linked.user_id;
      sessionId = s.id;
      if (await hasMfa(app, userId)) return "/login/2fa?next=/api/auth/discord/start?intent=admin";
    } else if (!linked) {
      // Signed-in user elevating with a Discord ID not linked anywhere: link it.
      const has = await app.db.query("SELECT 1 FROM oauth_accounts WHERE user_id = $1 AND provider = 'discord'", [userId]);
      if (has.rowCount) return "/admin/denied?reason=account_mismatch";
      await app.db.query("INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_username, provider_avatar) VALUES ($1,'discord',$2,$3,$4)",
        [userId, idn.id, idn.username, idn.avatar]);
    }
    if (c.session?.mfaPending) return "/login/2fa?next=/admin";
    await storeTokens(app, userId!, p, idn);
    const uid = (await app.db.query("SELECT uid FROM users WHERE id = $1", [userId])).rows[0].uid;
    await app.db.tx(async (tx) => {
      const adminSessionId = await createAdminSession(app, tx, sessionId!, userId!, idn.id, c.ip);
      await audit(tx, { userId, uid, discordId: idn.id, role: role.role, ip: c.ip, userAgent: c.ua, requestId: c.requestId },
        { action: "admin.session_started", targetType: "admin_session", targetId: adminSessionId, next: { role: role.role } });
    });
    return st.redirect_to?.startsWith("/admin") ? st.redirect_to : "/admin";
  }

  // ---------------------------------------------------------------- login
  if (linked) {
    try { await assertCanLogIn(app, linked.user_id); }
    catch (e) { return fail((e as HttpError).code ?? "account_restricted"); }
    const mfa = await hasMfa(app, linked.user_id);
    const s = await createSession(app, app.db, linked.user_id, p, c.ip, c.ua, mfa);
    await recordLogin(app, linked.user_id, p, c.ip, c.ua);
    await storeTokens(app, linked.user_id, p, idn);
    setSessionCookie(app, c, s.token);
    const next = st.redirect_to ?? "/dashboard";
    return mfa ? `/login/2fa?next=${encodeURIComponent(next)}` : next;
  }
  if (!(await isFlagEnabled(app, `signup.${p}`))) return fail("signup_disabled");
  await beginSignup(app, c, p, idn);
  return "/signup/complete";
}

async function hasMfa(app: App, userId: string) {
  return !!(await app.db.query("SELECT totp_enabled_at FROM users WHERE id = $1", [userId])).rows[0]?.totp_enabled_at;
}

async function beginSignup(app: App, c: Ctx, p: Provider, idn: Identity) {
  const token = randomToken();
  await app.db.query(
    `INSERT INTO oauth_signups (token_hash, provider, provider_user_id, provider_username, provider_avatar, email, email_verified, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now() + interval '30 minutes')`,
    [sha256(token), p, idn.id, idn.username, idn.avatar, idn.email, idn.emailVerified]);
  c.setCookie(SIGNUP_COOKIE, token, { maxAge: 1800, sameSite: "Lax" });
}

export async function pendingSignup(app: App, c: Ctx) {
  const token = c.cookies[SIGNUP_COOKIE];
  if (!token) return null;
  const r = (await app.db.query("SELECT * FROM oauth_signups WHERE token_hash = $1 AND expires_at > now()", [sha256(token)])).rows[0];
  if (!r) return null;
  return { provider: r.provider as Provider, username: r.provider_username, avatar: r.provider_avatar, email: r.email, emailVerified: r.email_verified, raw: r, token };
}

/** Finish an OAuth sign-up by choosing a username. */
export async function completeSignup(app: App, c: Ctx, username: string) {
  const pending = await pendingSignup(app, c);
  if (!pending) throw new HttpError(400, "signup_expired", "Your sign-up session expired. Start again.");
  const r = pending.raw;
  // A Google email is only adopted when Google says it is verified and unused.
  let email: string | null = null;
  if (r.email && r.email_verified) {
    const used = await app.db.query("SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL", [r.email]);
    if (!used.rowCount) email = r.email;
  }
  const user = await createAccount(app, {
    username, email, password: null, emailVerified: !!email,
    oauth: { provider: r.provider, providerUserId: r.provider_user_id, username: r.provider_username, avatar: r.provider_avatar, email: r.email },
  });
  await app.db.query("DELETE FROM oauth_signups WHERE token_hash = $1", [sha256(pending.token)]);
  c.clearCookie(SIGNUP_COOKIE);
  const s = await createSession(app, app.db, user.id, r.provider, c.ip, c.ua);
  await recordLogin(app, user.id, r.provider, c.ip, c.ua);
  setSessionCookie(app, c, s.token);
  return { user, isOwner: r.provider === "discord" && isOwnerDiscordId(app, r.provider_user_id) };
}

export async function unlinkProvider(app: App, userId: string, p: Provider, ip: string) {
  const u = (await app.db.query("SELECT password_hash FROM users WHERE id = $1", [userId])).rows[0];
  const others = (await app.db.query("SELECT count(*)::int AS n FROM oauth_accounts WHERE user_id = $1 AND provider <> $2", [userId, p])).rows[0].n;
  if (!u.password_hash && others === 0) throw new HttpError(400, "last_login_method", "Set a password before disconnecting your only sign-in method");
  const r = await app.db.query("DELETE FROM oauth_accounts WHERE user_id = $1 AND provider = $2", [userId, p]);
  if (!r.rowCount) throw new HttpError(404, "not_found", "Not connected");
  if (p === "discord") await app.db.query("UPDATE admin_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  await securityEvent(app.db, userId, "oauth.unlinked", "info", { provider: p }, ip);
}

export { SESSION_COOKIE };
