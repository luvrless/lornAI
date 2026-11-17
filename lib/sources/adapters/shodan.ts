import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// Shodan InternetDB – completely free, no API key required.
// https://internetdb.shodan.io/{ip}
export const shodanAdapter: Adapter = {
  meta: {
    id: "shodan-internetdb",
    name: "Shodan InternetDB",
    category: "ip",
    description: "Free Shodan InternetDB endpoint: open ports, CVEs, hostnames, tags, and CPEs for any public IP — no key required.",
    status: "integrated",
    supports: ["ip"],
    authRequired: false,
    privacy: "public",
    rateLimit: "1 req/s public",
    docsUrl: "https://internetdb.shodan.io/",
  },
  canRun: ({ identifierType }) => identifierType === "ip",
  async run({ normalized, signal }) {
    const url = `https://internetdb.shodan.io/${encodeURIComponent(normalized)}`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 10000 });
      if (res.status === 404) return { state: "no_results", findings: [], message: "IP not in Shodan InternetDB" };
      if (res.status === 429) return { state: "rate_limited", findings: [], message: "Shodan rate limited" };
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const d = await res.json() as Record<string, unknown>;
      const findings = [];
      const at = new Date().toISOString();
      if (d.ports && Array.isArray(d.ports) && d.ports.length)
        findings.push(mkFinding("shodan-internetdb", { key: "open_ports", label: "Open ports", value: (d.ports as number[]).join(", "), sourceUrl: url }));
      if (d.cpes && Array.isArray(d.cpes) && d.cpes.length)
        findings.push(mkFinding("shodan-internetdb", { key: "cpes", label: "CPE identifiers", value: (d.cpes as string[]).join("; "), sourceUrl: url }));
      if (d.vulns && Array.isArray(d.vulns) && d.vulns.length)
        findings.push(mkFinding("shodan-internetdb", { key: "vulns", label: "Known CVEs", value: (d.vulns as string[]).join(", "), confidence: 0.95, sourceUrl: url }));
      if (d.hostnames && Array.isArray(d.hostnames) && d.hostnames.length)
        findings.push(mkFinding("shodan-internetdb", { key: "hostnames", label: "Hostnames", value: (d.hostnames as string[]).join(", "), entityType: "domain", sourceUrl: url }));
      if (d.tags && Array.isArray(d.tags) && d.tags.length)
        findings.push(mkFinding("shodan-internetdb", { key: "tags", label: "Shodan tags", value: (d.tags as string[]).join(", "), sourceUrl: url }));
      return { state: findings.length ? "completed" : "no_results", findings, raw: d };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
