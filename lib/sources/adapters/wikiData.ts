import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// WikiData public SPARQL/REST API – no key.
// https://www.wikidata.org/wiki/Wikidata:Data_access
export const wikiDataAdapter: Adapter = {
  meta: {
    id: "wikidata",
    name: "Wikidata",
    category: "gov_data",
    description: "Wikidata structured public knowledge: search for companies, persons, organisations — returns labels, descriptions, and sitelinks.",
    status: "integrated",
    supports: ["organization", "username"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://www.wikidata.org/wiki/Wikidata:Data_access",
  },
  canRun: ({ identifierType }) => ["organization", "username"].includes(identifierType),
  async run({ normalized, signal }) {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(normalized)}&language=en&limit=5&format=json&origin=*`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 10000 });
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const data = await res.json() as { search?: Record<string, unknown>[] };
      if (!data.search?.length) return { state: "no_results", findings: [] };

      const findings = [];
      for (const item of data.search.slice(0, 5)) {
        const wdUrl = `https://www.wikidata.org/wiki/${item.id}`;
        const label = String(item.label || item.id || "");
        const desc = String(item.description || "");
        findings.push(mkFinding("wikidata", {
          key: `entity_${item.id}`,
          label: "Wikidata entity",
          value: `${label}${desc ? ` — ${desc}` : ""}`,
          entityType: "url",
          sourceUrl: wdUrl,
        }));

        // Also check Wikipedia sitelink
        try {
          const eRes = await fetchWithTimeout(
            `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${item.id}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`,
            { signal, timeoutMs: 6000 }
          );
          if (eRes.ok) {
            const eData = await eRes.json() as { entities?: Record<string, Record<string, unknown>> };
            const ent = eData.entities?.[String(item.id)];
            const sl = (ent?.sitelinks as Record<string, unknown> | undefined)?.enwiki as Record<string, unknown> | undefined;
            if (sl?.title) {
              const wpUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(String(sl.title).replace(/ /g, "_"))}`;
              findings.push(mkFinding("wikidata", { key: `wiki_${item.id}`, label: "Wikipedia article", value: String(sl.title), entityType: "url", sourceUrl: wpUrl }));
            }
          }
        } catch { /* ignore */ }
      }

      return { state: "completed", findings };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
