import type { App } from "../../app.ts";
import type { Ctx } from "../../lib/http.ts";
import { hmac } from "../../lib/crypto.ts";

export const SESSION_COOKIE = "lorn_session";

export function setSessionCookie(_app: App, c: Ctx, token: string) {
  c.setCookie(SESSION_COOKIE, token, { maxAge: 60 * 60 * 24 * 30, sameSite: "Lax" });
}

export function clearSessionCookie(c: Ctx) {
  c.clearCookie(SESSION_COOKIE);
}

/** CSRF token bound to the session ID; returned by /api/auth/me. */
export const csrfFor = (app: App, sessionId: string) => hmac(app.cfg.sessionSecret, `csrf:${sessionId}`);
