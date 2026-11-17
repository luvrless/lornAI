import crypto from "node:crypto";
import { fetchWithTimeout, SourceError } from "./http";

// Privacy-preserving password exposure check using the HIBP Pwned Passwords
// k-anonymity range API. Only the first 5 chars of the SHA-1 are sent; the full
// password and hash never leave this server.
export async function checkPasswordExposure(
  password: string
): Promise<{ exposed: boolean; count: number }> {
  if (!password) throw new SourceError("empty password", "failed");
  const sha1 = crypto.createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const res = await fetchWithTimeout(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    { timeoutMs: 10000, headers: { "Add-Padding": "true", accept: "text/plain" } }
  );
  if (res.status === 429) throw new SourceError("rate limited", "rate_limited");
  if (!res.ok) throw new SourceError(`HTTP ${res.status}`, "unavailable");
  const body = await res.text();
  for (const line of body.split("\n")) {
    const [suf, cnt] = line.trim().split(":");
    if (suf === suffix) {
      const count = parseInt(cnt, 10) || 0;
      return { exposed: count > 0, count };
    }
  }
  return { exposed: false, count: 0 };
}
