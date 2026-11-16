/** Periodic platform tasks. Imported once by the server; each registers itself. */
import type { App } from "../../app.ts";
import { every, enqueue, registerJob } from "./runner.ts";
import { sendMail } from "../../lib/smtp.ts";
import { sendViaResend } from "../../lib/resend.ts";
import { cleanupOrphans } from "../media/service.ts";
import { pruneAnalytics } from "../analytics/service.ts";
import "../events/service.ts"; // registers event tick + milestone jobs
import { recheckBoosters } from "../badges/booster.ts";

export async function deliverEmails(app: App, limit = 20) {
  if (!app.cfg.smtp && !app.cfg.resend) return 0;
  const batch = (await app.db.query(
    `UPDATE email_outbox SET attempts = attempts + 1 WHERE id IN (
       SELECT id FROM email_outbox WHERE status = 'pending' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $1) RETURNING *`, [limit])).rows.sort((a: any, b: any) => Number(a.id) - Number(b.id)); // oldest first
  let sent = 0;
  for (const m of batch) {
    try {
      const mail = { to: m.to_address, subject: m.subject, text: m.text_body, html: m.html_body ?? undefined };
      if (app.cfg.resend) await sendViaResend(app.cfg.resend, { ...mail, from: app.cfg.resend.from }, `lorn-outbox-${m.id}`);
      else await sendMail(app.cfg.smtp!.url, { ...mail, from: app.cfg.smtp!.from });
      await app.db.query("UPDATE email_outbox SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = $1", [m.id]);
      sent++;
    } catch (e) {
      await app.db.query("UPDATE email_outbox SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END, last_error = $2 WHERE id = $1", [m.id, (e as Error).message.slice(0, 500)]);
    }
  }
  return sent;
}

every(15_000, "deliver_emails", async (app) => { await deliverEmails(app); });
every(3_600_000, "cleanup_orphans", async (app) => { await cleanupOrphans(app); });
every(86_400_000, "daily", async (app) => {
  await pruneAnalytics(app);
  await app.db.query("DELETE FROM oauth_states WHERE expires_at < now()");
  await app.db.query("DELETE FROM oauth_signups WHERE expires_at < now()");
  await app.db.query("DELETE FROM integration_cache WHERE expires_at < now() - interval '1 day'");
  await recheckBoosters(app).catch((e) => app.log.warn?.("booster recheck failed", e));
  await enqueue(app.db, "milestone.og_reconcile", {}, { idempotencyKey: `og-reconcile:${new Date().toISOString().slice(0, 10)}` });
});

registerJob("noop", async () => {});
