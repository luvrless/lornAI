/**
 * Server Booster badge: verified against Discord, never taken on the user's word.
 *
 * Needs a bot in the LORN.LOL Discord server (DISCORD_BOT_TOKEN, DISCORD_GUILD_ID).
 * The claim looks up the member by the user's linked Discord ID and checks
 * `premium_since`. A daily job re-checks holders and removes the badge once the
 * boost has ended. Without the bot configured the claim says so plainly.
 */
import type { App, Queryable } from "../../app.ts";
import { HttpError, unavailable } from "../../lib/errors.ts";
import { assignBadge } from "./service.ts";
import { notify } from "../platform/service.ts";

export const BOOSTER_KEY = "server_booster";

export function boosterConfig() {
  const token = process.env.DISCORD_BOT_TOKEN, guild = process.env.DISCORD_GUILD_ID;
  return token && guild ? { token, guild, api: process.env.DISCORD_API_BASE ?? "https://discord.com/api/v10" } : null;
}
export const boosterStatus = () => boosterConfig() ? "configured" : "not_configured: set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID";

/** true = boosting, false = in the server but not boosting, null = not a member. */
async function isBoosting(app: App, discordId: string): Promise<boolean | null> {
  const c = boosterConfig();
  if (!c) throw unavailable("Server Booster checks aren't set up on this server yet", "booster_not_configured");
  const r = await app.fetch(`${c.api}/guilds/${c.guild}/members/${discordId}`, {
    headers: { Authorization: `Bot ${c.token}` }, signal: AbortSignal.timeout(10_000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new HttpError(502, "discord_error", `Discord didn't answer the boost check (${r.status}). Try again in a minute.`);
  const m = await r.json() as { premium_since?: string | null };
  return !!m.premium_since;
}

async function linkedDiscordId(db: Queryable, userId: string): Promise<string | null> {
  return (await db.query("SELECT provider_user_id FROM oauth_accounts WHERE user_id = $1 AND provider = 'discord'", [userId])).rows[0]?.provider_user_id ?? null;
}

export async function claimBoosterBadge(app: App, userId: string) {
  if (!boosterConfig()) throw unavailable("Server Booster checks aren't set up on this server yet", "booster_not_configured");
  const discordId = await linkedDiscordId(app.db, userId);
  if (!discordId) throw new HttpError(409, "discord_not_linked", "Link your Discord account in Account settings first, then claim again.");
  const boosting = await isBoosting(app, discordId);
  if (boosting === null) throw new HttpError(409, "not_in_server", "Your linked Discord account isn't in the LORN.LOL server.");
  if (!boosting) throw new HttpError(409, "not_boosting", "Your linked Discord account isn't boosting the LORN.LOL server right now.");
  const added = await app.db.tx((tx) => assignBadge(app, tx, userId, BOOSTER_KEY, { method: "automatic", actor: null, reason: "Boosting the Discord server", idempotencyKey: `booster:${userId}:${new Date().toISOString().slice(0, 10)}` }));
  const { invalidateProfileCache } = await import("../profiles/service.ts");
  invalidateProfileCache(app, userId);
  return { claimed: true, alreadyHad: !added };
}

/** Daily: remove the badge from anyone no longer boosting (or who unlinked Discord). */
export async function recheckBoosters(app: App) {
  if (!boosterConfig()) return { checked: 0, removed: 0 };
  const holders = (await app.db.query(
    `SELECT ub.user_id, oa.provider_user_id AS discord_id FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
     LEFT JOIN oauth_accounts oa ON oa.user_id = ub.user_id AND oa.provider = 'discord'
     WHERE b.key = $1 AND ub.method = 'automatic'`, [BOOSTER_KEY])).rows;
  let removed = 0;
  for (const h of holders) {
    let still: boolean | null;
    try { still = h.discord_id ? await isBoosting(app, h.discord_id) : null; } catch { continue; } // Discord hiccup: keep the badge, retry tomorrow
    if (still) continue;
    await app.db.query("DELETE FROM user_badges ub USING badges b WHERE ub.badge_id = b.id AND b.key = $2 AND ub.user_id = $1", [h.user_id, BOOSTER_KEY]);
    await notify(app.db, h.user_id, "badge", "Your Server Booster badge was removed", "Your boost on the LORN.LOL Discord server ended. Boost again and claim it to get it back.");
    const { invalidateProfileCache } = await import("../profiles/service.ts");
    invalidateProfileCache(app, h.user_id);
    removed++;
  }
  return { checked: holders.length, removed };
}
