import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// URLScan.io search API – read is keyless (no auth needed for search).
// https://urlscan.io/docs/api/
export const urlscanAdapter: Adapter = {
  meta: {
    id: "urlscan",
    name: "URLScan.io",
    category: "url_reputation",
    description: "Free URLScan.io search: past scans for a domain or URL — screenshots, page title, IP, tech fingerprint, verdicts.",
    status: "integrated",
    supports: ["domain", "url"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://urlscan.io/docs/api/",
  },
  canRun: ({ identifierType }) => ["domain", "url"].includes(identifierType),
  async run({ normalized, identifierType, signal }) {
    const q = identifierType === "url" ? `page.url:"${normalized}"` : `page.domain:"${normalized}"`;
    const url = `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(q)}&size=10`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 12000 });
      if (res.status === 429) return { state: "rate_limited", findings: [], message: "URLScan rate limited" };
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const data = await res.json() as { results?: Record<string, unknown>[] };
      if (!data.results?.length) return { state: "no_results", findings: [] };

      const findings = [];
      for (const r of data.results) {
        const pg = r["page"] as Record<string, unknown> | undefined;
        const scan = r["_id"] as string | undefined;
        const scanUrl = scan ? `https://urlscan.io/result/${scan}/` : undefined;
        if (pg?.url) findings.push(mkFinding("urlscan", { key: `scan_url_${findings.length}`, label: "Scanned URL", value: String(pg.url), entityType: "url", sourceUrl: scanUrl }));
        if (pg?.title) findings.push(mkFinding("urlscan", { key: `title_${findings.length}`, label: "Page title", value: String(pg.title), sourceUrl: scanUrl }));
        if (pg?.ip) findings.push(mkFinding("urlscan", { key: `ip_${findings.length}`, label: "Resolved IP", value: String(pg.ip), entityType: "ip", sourceUrl: scanUrl }));
        if (pg?.country) findings.push(mkFinding("urlscan", { key: `country_${findings.length}`, label: "IP country", value: String(pg.country), sourceUrl: scanUrl }));
        if (pg?.server) findings.push(mkFinding("urlscan", { key: `server_${findings.length}`, label: "Server header", value: String(pg.server), sourceUrl: scanUrl }));
        const verdict = (r["verdicts"] as Record<string, unknown> | undefined)?.["overall"] as Record<string, unknown> | undefined;
        if (verdict?.score !== undefined) findings.push(mkFinding("urlscan", { key: `verdict_${findings.length}`, label: "Verdict score", value: `${verdict.score}${verdict.malicious ? " (malicious)" : ""}`, sourceUrl: scanUrl }));
      }

      return { state: "completed", findings, raw: { total: data.results.length } };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
