import type { Adapter, Finding } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// HackerTarget free API – many recon tools, no key needed (rate-limited).
// https://api.hackertarget.com/
export const hackerTargetAdapter: Adapter = {
  meta: {
    id: "hackertarget",
    name: "HackerTarget Recon",
    category: "subdomains",
    description: "Free recon APIs: reverse IP lookup, DNS lookup, DNS host lookup, subdomain finder, and ASN data — no API key needed.",
    status: "integrated",
    supports: ["domain", "ip"],
    authRequired: false,
    privacy: "public",
    rateLimit: "~100/day free",
    docsUrl: "https://hackertarget.com/ip-tools/",
  },
  canRun: ({ identifierType }) => ["domain", "ip"].includes(identifierType),
  async run({ normalized, identifierType, signal }) {
    const findings: Finding[] = [];
    const base = "https://api.hackertarget.com";

    async function ht(endpoint: string, label: string, key: string, entityType?: string) {
      try {
        const res = await fetchWithTimeout(`${base}/${endpoint}/?q=${encodeURIComponent(normalized)}`, {
          signal, timeoutMs: 10000,
          headers: { accept: "text/plain" },
        });
        if (!res.ok) return;
        const text = (await res.text()).trim();
        if (!text || text.startsWith("error") || text.startsWith("API count exceeded")) return;
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        for (const line of lines.slice(0, 100)) {
          findings.push(mkFinding("hackertarget", {
            key: `${key}_${findings.length}`,
            label,
            value: line,
            entityType: entityType as never,
            sourceUrl: `${base}/${endpoint}/?q=${encodeURIComponent(normalized)}`,
          }));
        }
        if (lines.length > 100) {
          findings.push(mkFinding("hackertarget", { key: `${key}_trunc`, label: `${label} (truncated)`, value: `+${lines.length - 100} more results` }));
        }
      } catch { /* ignore */ }
    }

    if (identifierType === "domain") {
      await ht("hostsearch", "Subdomain / host", "subdomain", "domain");
      await ht("dnslookup", "DNS record", "dns");
      await ht("reverseiplookup", "Reverse IP host", "rev_ip_host", "domain");
    }
    if (identifierType === "ip") {
      await ht("reverseiplookup", "Reverse IP host", "rev_ip_host", "domain");
      await ht("aslookup", "ASN info", "asn");
      await ht("geoip", "GeoIP", "geoip");
    }

    return { state: findings.length ? "completed" : "no_results", findings };
  },
};
