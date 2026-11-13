/**
 * Environment configuration. Required values fail fast at boot; optional
 * integrations report an explicit "not configured" state instead of faking.
 */
import crypto from "node:crypto";

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export interface Config {
  env: "development" | "production" | "test";
  port: number;
  appUrl: string;
  appOrigin: string;
  secureCookies: boolean;
  trustProxy: boolean;
  databaseUrl: string;
  sessionSecret: Buffer;
  encryptionKey: Buffer;
  ownerDiscordId: string | null;
  discord: { clientId: string; clientSecret: string; apiBase: string; authorizeUrl: string } | null;
  google: { clientId: string; clientSecret: string; tokenUrl: string; authorizeUrl: string; userinfoUrl: string } | null;
  smtp: { url: string; from: string } | null;
}

export function loadConfig(): Config {
  const nodeEnv = (env("NODE_ENV", "development") as Config["env"]);
  const appUrl = env("APP_URL", "http://localhost:3000")!.replace(/\/$/, "");
  const databaseUrl = env("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const secret = (name: string) => {
    const v = env(name);
    if (v) {
      const b = Buffer.from(v, "base64");
      if (b.length < 32) throw new Error(`${name} must be at least 32 bytes, base64-encoded`);
      return b.subarray(0, 32);
    }
    if (nodeEnv === "production") throw new Error(`${name} is required in production`);
    return crypto.createHash("sha256").update(`lorn-dev-${name}`).digest(); // dev only
  };

  const ownerId = env("LORN_OWNER_DISCORD_ID") ?? null;
  if (ownerId && !/^\d{17,20}$/.test(ownerId)) throw new Error("LORN_OWNER_DISCORD_ID must be a Discord snowflake");

  const dId = env("DISCORD_CLIENT_ID"), dSecret = env("DISCORD_CLIENT_SECRET");
  const gId = env("GOOGLE_CLIENT_ID"), gSecret = env("GOOGLE_CLIENT_SECRET");
  const smtpUrl = env("SMTP_URL");

  return {
    env: nodeEnv,
    port: Number(env("PORT", "3000")),
    appUrl,
    appOrigin: new URL(appUrl).origin,
    secureCookies: appUrl.startsWith("https://"),
    trustProxy: env("TRUST_PROXY", "false") === "true",
    databaseUrl,
    sessionSecret: secret("SESSION_SECRET"),
    encryptionKey: secret("ENCRYPTION_KEY"),
    ownerDiscordId: ownerId,
    discord: dId && dSecret ? {
      clientId: dId, clientSecret: dSecret,
      apiBase: env("DISCORD_API_BASE", "https://discord.com/api/v10")!,
      authorizeUrl: env("DISCORD_AUTHORIZE_URL", "https://discord.com/oauth2/authorize")!,
    } : null,
    google: gId && gSecret ? {
      clientId: gId, clientSecret: gSecret,
      authorizeUrl: env("GOOGLE_AUTHORIZE_URL", "https://accounts.google.com/o/oauth2/v2/auth")!,
      tokenUrl: env("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token")!,
      userinfoUrl: env("GOOGLE_USERINFO_URL", "https://openidconnect.googleapis.com/v1/userinfo")!,
    } : null,
    smtp: smtpUrl ? { url: smtpUrl, from: env("MAIL_FROM", "LORN.LOL <no-reply@lorn.lol>")! } : null,
  };
}

/** What's missing, for the admin "Integrations / System health" page. */
export function configStatus(c: Config) {
  return {
    discordOAuth: c.discord ? "configured" : "not_configured: set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET",
    googleOAuth: c.google ? "configured" : "not_configured: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
    email: c.smtp ? "configured" : "not_configured: set SMTP_URL (smtp[s]://user:pass@host:port) and MAIL_FROM",
    owner: c.ownerDiscordId ? "configured" : "not_configured: set LORN_OWNER_DISCORD_ID",
  };
}
