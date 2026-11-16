/**
 * Token-bucket rate limiter. In-process store; the interface allows a
 * Redis-backed store for multi-instance deployments (see CHECKLIST.md).
 */
export interface RateLimitRule {
  /** bucket capacity (burst) */
  capacity: number;
  /** tokens added per second */
  refillPerSec: number;
}

export interface RateLimitStore {
  take(key: string, rule: RateLimitRule, cost?: number): { ok: boolean; retryAfter: number };
  reset(key: string): void;
}

export class MemoryRateLimiter implements RateLimitStore {
  private buckets = new Map<string, { tokens: number; at: number }>();
  private timer: NodeJS.Timeout;

  constructor() {
    this.timer = setInterval(() => this.sweep(), 60_000);
    this.timer.unref();
  }

  take(key: string, rule: RateLimitRule, cost = 1) {
    const now = Date.now();
    const b = this.buckets.get(key) ?? { tokens: rule.capacity, at: now };
    b.tokens = Math.min(rule.capacity, b.tokens + ((now - b.at) / 1000) * rule.refillPerSec);
    b.at = now;
    if (b.tokens >= cost) {
      b.tokens -= cost;
      this.buckets.set(key, b);
      return { ok: true, retryAfter: 0 };
    }
    this.buckets.set(key, b);
    return { ok: false, retryAfter: Math.ceil((cost - b.tokens) / rule.refillPerSec) };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  private sweep() {
    const cutoff = Date.now() - 3_600_000;
    for (const [k, b] of this.buckets) if (b.at < cutoff) this.buckets.delete(k);
  }
}

export const RULES = {
  global: { capacity: 300, refillPerSec: 5 },
  auth: { capacity: 10, refillPerSec: 10 / 60 },          // 10 / min burst
  register: { capacity: 5, refillPerSec: 5 / 3600 },       // 5 / hour per IP
  emailSend: { capacity: 3, refillPerSec: 3 / 3600 },
  codeSend: { capacity: 5, refillPerSec: 5 / 900 },         // 5 codes per 15 min per account      // 3 / hour per account
  admin: { capacity: 120, refillPerSec: 2 },
  usernameCheck: { capacity: 30, refillPerSec: 1 },
} satisfies Record<string, RateLimitRule>;
