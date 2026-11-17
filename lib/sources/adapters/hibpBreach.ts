import type { Adapter, Finding } from "../../types";
import { fetchWithTimeout, SourceError } from "../http";
import { mkFinding } from "../util";

interface HibpBreach {
  Name?: string;
  Title?: string;
  BreachDate?: string;
  AddedDate?: string;
  PwnCount?: number;
  DataClasses?: string[];
  Domain?: string;
}

// Defensive breach-exposure notification via Have I Been Pwned.
// Requires a subscription API key. Returns only safe exposure METADATA —
// never passwords, hashes or other compromised secrets.
export const hibpBreachAdapter: Adapter = {
  meta: {
    id: "hibp-breaches",
    name: "Breach Exposure (Have I Been Pwned)",
    category: "breach",
    description:
      "Lists breaches an email address appears in (service name, date, exposed data categories). Returns safe metadata only — never leaked secrets. Needs a HIBP API key.",
    status: "requires_key",
    supports: ["email"],
    docsUrl: "https://haveibeenpwned.com/API/v3",
    authRequired: true,
    privacy: "defensive",
    rateLimit: "Per HIBP subscription tier",
  },
  canRun: ({ identifierType }) => identifierType === "email",
  async run({ normalized, env, signal }) {
    const key = env.HIBP_API_KEY;
    if (!key) {
      return {
        state: "auth_required",
        findings: [],
        message: "Configure HIBP_API_KEY to enable breach-exposure lookups.",
      };
    }
    const res = await fetchWithTimeout(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(normalized)}?truncateResponse=false`,
      { signal, timeoutMs: 12000, headers: { "hibp-api-key": key, accept: "application/json" } }
    );
    if (res.status === 404)
      return { state: "no_results", findings: [], message: "No breaches found — good news." };
    if (res.status === 401) throw new SourceError("invalid HIBP key", "auth_required");
    if (res.status === 429) throw new SourceError("rate limited", "rate_limited");
    if (!res.ok) throw new SourceError(`HTTP ${res.status}`, "unavailable");
    const breaches = (await res.json()) as HibpBreach[];
    const findings: Finding[] = breaches.map((b) =>
      mkFinding("hibp-breaches", {
        key: "breach",
        label: b.Title || b.Name || "Breach",
        value: `${b.Title || b.Name} — ${b.BreachDate || "?"} — exposed: ${(b.DataClasses || []).join(", ")}`,
        confidence: 0.95,
        publishedAt: b.AddedDate,
        categories: b.DataClasses,
        sensitive: true,
        sourceUrl: b.Domain ? `https://${b.Domain}` : undefined,
        extra: { pwnCount: b.PwnCount, remediation: "Reset the password for this service and any site where it was reused; enable 2FA." },
      })
    );
    return { state: "completed", findings, message: `${breaches.length} breach(es)`, raw: breaches.map((b) => b.Name) };
  },
};
