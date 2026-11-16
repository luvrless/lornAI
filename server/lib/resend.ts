/** Resend's HTTP API: one POST per message, idempotent per outbox row so a retry never double-sends. */
import type { Mail } from "./smtp.ts";

export async function sendViaResend(cfg: { apiKey: string; apiBase: string; replyTo?: string | null }, m: Mail, idempotencyKey?: string): Promise<string> {
  const res = await fetch(`${cfg.apiBase}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from: m.from, to: [m.to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}), ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Resend ${res.status}: ${String(body?.message ?? body?.name ?? "request failed").slice(0, 300)}`);
  return String(body?.id ?? "");
}
