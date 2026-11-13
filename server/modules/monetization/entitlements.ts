import type { Queryable } from "../../app.ts";

export type EntitlementKind = "premium" | "verified";

/** Active = not revoked, started, and not expired. Existing records survive Premium being switched off. */
export async function hasEntitlement(db: Queryable, userId: string, kind: EntitlementKind): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM entitlements WHERE user_id = $1 AND kind = $2 AND revoked_at IS NULL
       AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now()) LIMIT 1`, [userId, kind]);
  return (r.rowCount ?? 0) > 0;
}

export async function activeEntitlements(db: Queryable, userId: string) {
  return (await db.query(
    `SELECT id, kind, source, starts_at, expires_at, reason, created_at FROM entitlements
     WHERE user_id = $1 AND revoked_at IS NULL AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC`, [userId])).rows;
}
