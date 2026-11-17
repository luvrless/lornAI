import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// CIRCL Passive DNS – public tier (no key for limited queries).
// https://www.circl.lu/services/passive-dns/
export const circlPdnsAdapter: Adapter = {
  meta: {
    id: "circl-pdns-public",
    name: "CIRCL Passive DNS (public)",
    category: "dns",
    description: "CIRCL.lu passive DNS database: historical DNS resolution records for a domain or IP — limited public access.",
    status: "integrated",
    supports: ["domain", "ip"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://www.circl.lu/services/passive-dns/",
  },
  canRun: ({ identifierType }) => ["domain", "ip"].includes(identifierType),
  async run({ normalized, signal }) {
    const url = `https://rdap.circl.lu/pdns/query/${encodeURIComponent(normalized)}`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 12000, headers: { accept: "application/json" } });
      if (res.status === 404 || res.status === 204) return { state: "no_results", findings: [] };
      if (res.status === 429) return { state: "rate_limited", findings: [] };
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };

      // CIRCL PDNS returns NDJSON (newline-delimited JSON)
      const text = await res.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (!lines.length) return { state: "no_results", findings: [] };

      const findings = [];
      const seen = new Set<string>();
      for (const line of lines.slice(0, 50)) {
        try {
          const r = JSON.parse(line) as Record<string, unknown>;
          const key = `${r.rrtype}:${r.rrname}:${r.rdata}`;
          if (seen.has(key)) continue;
          seen.add(key);
          findings.push(mkFinding("circl-pdns-public", {
            key: `pdns_${findings.length}`,
            label: `Passive DNS ${r.rrtype || "record"}`,
            value: `${r.rrname} → ${r.rdata}${r.time_last ? ` (last: ${r.time_last})` : ""}`,
            sourceUrl: `https://www.circl.lu/pdns/query/${normalized}`,
          }));
        } catch { /* skip malformed line */ }
      }

      return { state: findings.length ? "completed" : "no_results", findings };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
