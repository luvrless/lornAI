import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// CrossRef – open scholarly metadata, no key (email contact encouraged).
// https://api.crossref.org/
export const crossRefAdapter: Adapter = {
  meta: {
    id: "crossref",
    name: "Crossref",
    category: "academic",
    description: "Crossref scholarly metadata: search for published works, author affiliations, DOIs by person/org name.",
    status: "integrated",
    supports: ["organization", "username"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://api.crossref.org/swagger-ui/index.html",
  },
  canRun: ({ identifierType }) => ["organization", "username"].includes(identifierType),
  async run({ normalized, signal }) {
    const url = `https://api.crossref.org/works?query.author=${encodeURIComponent(normalized)}&rows=5&select=DOI,title,author,published,publisher`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 12000, headers: { "user-agent": "lorn-osint/1.0 (mailto:research@lorn.lol)" } });
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const data = await res.json() as { message?: { "total-results"?: number; items?: Record<string, unknown>[] } };
      const msg = data.message;
      if (!msg?.["total-results"] || !msg.items?.length) return { state: "no_results", findings: [] };

      const findings = [];
      findings.push(mkFinding("crossref", { key: "total", label: "Crossref works found", value: String(msg["total-results"]) }));

      for (const item of msg.items.slice(0, 5)) {
        const doi = String(item.DOI || "");
        const doiUrl = doi ? `https://doi.org/${doi}` : undefined;
        const titles = item.title as string[] | undefined;
        const title = titles?.[0] || "";
        const pub = item.publisher ? String(item.publisher) : "";
        const year = (item.published as Record<string, unknown> | undefined)?.["date-parts"];
        const yearStr = Array.isArray(year) && Array.isArray(year[0]) ? String(year[0][0]) : "";
        const authors = item.author as Array<{ given?: string; family?: string }> | undefined;
        const authorStr = authors ? authors.slice(0, 3).map(a => [a.given, a.family].filter(Boolean).join(" ")).join(", ") : "";
        findings.push(mkFinding("crossref", {
          key: `work_${doi || findings.length}`,
          label: "Published work",
          value: `${title}${yearStr ? ` (${yearStr})` : ""}${pub ? ` — ${pub}` : ""}${authorStr ? ` | Authors: ${authorStr}` : ""}`,
          entityType: doiUrl ? "url" : undefined,
          sourceUrl: doiUrl,
        }));
      }

      return { state: "completed", findings };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
