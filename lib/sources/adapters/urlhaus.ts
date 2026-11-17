import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// URLhaus by abuse.ch – public, no key needed.
// https://urlhaus.abuse.ch/api/
export const urlhausAdapter: Adapter = {
  meta: {
    id: "urlhaus",
    name: "URLhaus (abuse.ch)",
    category: "malware",
    description: "URLhaus by abuse.ch: check if a domain or URL has been reported as distributing malware — no API key needed.",
    status: "integrated",
    supports: ["domain", "url"],
    authRequired: false,
    privacy: "defensive",
    docsUrl: "https://urlhaus.abuse.ch/api/",
  },
  canRun: ({ identifierType }) => ["domain", "url"].includes(identifierType),
  async run({ normalized, identifierType, signal }) {
    const payload = identifierType === "url"
      ? `url=${encodeURIComponent(normalized)}`
      : `host=${encodeURIComponent(normalized)}`;

    try {
      const res = await fetchWithTimeout("https://urlhaus-api.abuse.ch/v1/" + (identifierType === "url" ? "url/" : "host/"), {
        method: "POST",
        signal,
        timeoutMs: 10000,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: payload,
      });
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const d = await res.json() as Record<string, unknown>;
      if (d.query_status === "no_results") return { state: "no_results", findings: [], message: "Not in URLhaus" };

      const findings = [];
      if (d.query_status) findings.push(mkFinding("urlhaus", { key: "status", label: "URLhaus status", value: String(d.query_status), confidence: 0.95 }));
      if (d.host) findings.push(mkFinding("urlhaus", { key: "host", label: "Host", value: String(d.host) }));
      if (d.urls_count !== undefined) findings.push(mkFinding("urlhaus", { key: "urls_count", label: "Malicious URLs reported", value: String(d.urls_count), confidence: 0.95 }));

      const urls = d.urls as Record<string, unknown>[] | undefined;
      if (Array.isArray(urls)) {
        for (const u of urls.slice(0, 5)) {
          findings.push(mkFinding("urlhaus", {
            key: `malware_url_${findings.length}`,
            label: "Malware URL",
            value: `${u.url_status} — ${u.threat || ""} — ${u.url}`,
            confidence: 0.9,
            sourceUrl: `https://urlhaus.abuse.ch/url/${u.id}/`,
          }));
        }
      }

      return { state: findings.length ? "completed" : "no_results", findings, raw: d };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
