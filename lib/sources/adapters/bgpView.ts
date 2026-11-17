import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// BGPView – completely free, no key needed.
// https://bgpview.docs.apiary.io/
export const bgpViewAdapter: Adapter = {
  meta: {
    id: "bgpview",
    name: "BGPView",
    category: "asn",
    description: "Free BGPView API: ASN info, prefixes, peers, upstreams, and IXs for IP addresses — no API key.",
    status: "integrated",
    supports: ["ip"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://bgpview.docs.apiary.io/",
  },
  canRun: ({ identifierType }) => identifierType === "ip",
  async run({ normalized, signal }) {
    const findings = [];
    const url = `https://api.bgpview.io/ip/${encodeURIComponent(normalized)}`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 10000 });
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const json = await res.json() as { status?: string; data?: Record<string, unknown> };
      if (json.status !== "ok" || !json.data) return { state: "no_results", findings: [] };
      const d = json.data;

      const g = (o: unknown, k: string): unknown => o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined;

      if (d.ip) findings.push(mkFinding("bgpview", { key: "ip", label: "IP address", value: String(d.ip), sourceUrl: url }));
      if (d.country_code) findings.push(mkFinding("bgpview", { key: "country", label: "Country", value: String(d.country_code), sourceUrl: url }));
      if (d.rir_allocation) {
        const rir = d.rir_allocation as Record<string, unknown>;
        if (rir.rir_name) findings.push(mkFinding("bgpview", { key: "rir", label: "RIR", value: String(rir.rir_name) }));
        if (rir.prefix) findings.push(mkFinding("bgpview", { key: "rir_prefix", label: "Allocated prefix", value: String(rir.prefix) }));
        if (rir.date_allocated) findings.push(mkFinding("bgpview", { key: "date_allocated", label: "Date allocated", value: String(rir.date_allocated) }));
      }
      if (Array.isArray(d.prefixes)) {
        for (const p of (d.prefixes as Record<string, unknown>[]).slice(0, 10)) {
          const asn = g(p.asn, "asn");
          const name = g(p.asn, "name");
          const prefix = p.prefix;
          const desc = p.description;
          if (prefix) findings.push(mkFinding("bgpview", {
            key: `prefix_${findings.length}`,
            label: "BGP prefix",
            value: `${prefix}${asn ? ` (AS${asn} ${name || ""})` : ""}${desc ? ` — ${desc}` : ""}`,
            sourceUrl: url,
          }));
        }
      }
      return { state: findings.length ? "completed" : "no_results", findings, raw: d };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
