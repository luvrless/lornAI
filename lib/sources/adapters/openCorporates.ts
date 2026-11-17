import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// OpenCorporates – free tier public search, no key for basic search.
// https://api.opencorporates.com/
export const openCorporatesAdapter: Adapter = {
  meta: {
    id: "opencorporates-search",
    name: "OpenCorporates",
    category: "company_registry",
    description: "World's largest open company database: search global company registrations by name — jurisdiction, status, officers.",
    status: "integrated",
    supports: ["organization"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://api.opencorporates.com/",
  },
  canRun: ({ identifierType }) => identifierType === "organization",
  async run({ normalized, signal }) {
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(normalized)}&per_page=5`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 12000 });
      if (res.status === 429) return { state: "rate_limited", findings: [] };
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const data = await res.json() as { results?: { companies?: Record<string, unknown>[] }; total_count?: number };
      const companies = data.results?.companies;
      if (!companies?.length) return { state: "no_results", findings: [] };

      const findings = [];
      if (data.total_count) findings.push(mkFinding("opencorporates-search", { key: "total", label: "Registry matches", value: String(data.total_count) }));

      for (const wrapper of companies.slice(0, 5)) {
        const c = (wrapper as Record<string, unknown>)["company"] as Record<string, unknown> | undefined;
        if (!c) continue;
        const ocUrl = String(c.opencorporates_url || "");
        const jur = String(c.jurisdiction_code || "");
        const status = String(c.current_status || "");
        const name = String(c.name || "");
        const num = String(c.company_number || "");
        findings.push(mkFinding("opencorporates-search", {
          key: `company_${c.company_number || findings.length}`,
          label: "Company",
          value: `${name} [${jur}] #${num}${status ? ` (${status})` : ""}`,
          entityType: "url",
          sourceUrl: ocUrl,
        }));
        if (c.registered_address_in_full) findings.push(mkFinding("opencorporates-search", {
          key: `addr_${c.company_number}`,
          label: `${name} — Address`,
          value: String(c.registered_address_in_full),
          sourceUrl: ocUrl,
        }));
        if (c.incorporation_date) findings.push(mkFinding("opencorporates-search", {
          key: `incorp_${c.company_number}`,
          label: `${name} — Incorporated`,
          value: String(c.incorporation_date),
          sourceUrl: ocUrl,
        }));
      }

      return { state: "completed", findings };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
