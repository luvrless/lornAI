import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// ORCID – open researcher identity registry, public API, no key.
// https://info.orcid.org/documentation/features/public-api/
export const orcidAdapter: Adapter = {
  meta: {
    id: "orcid",
    name: "ORCID",
    category: "academic",
    description: "ORCID open researcher registry: search by name/email for researcher profiles, affiliations, works, and education.",
    status: "integrated",
    supports: ["username", "email"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://info.orcid.org/documentation/",
  },
  canRun: ({ identifierType }) => ["username", "email"].includes(identifierType),
  async run({ normalized, identifierType, signal }) {
    const q = identifierType === "email" ? `email:${normalized}` : `${normalized}`;
    const url = `https://pub.orcid.org/v3.0/search?q=${encodeURIComponent(q)}&rows=5`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 12000, headers: { accept: "application/json" } });
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const data = await res.json() as { "num-found"?: number; result?: Record<string, unknown>[] };
      if (!data["num-found"] || !data.result?.length) return { state: "no_results", findings: [] };

      const findings = [];
      findings.push(mkFinding("orcid", { key: "total", label: "ORCID matches", value: String(data["num-found"]) }));

      for (const r of data.result.slice(0, 5)) {
        const orcidId = (r["orcid-identifier"] as Record<string, unknown> | undefined)?.path;
        if (!orcidId) continue;
        const profileUrl = `https://orcid.org/${orcidId}`;

        // Fetch individual profile
        try {
          const pRes = await fetchWithTimeout(`https://pub.orcid.org/v3.0/${orcidId}/person`, { signal, timeoutMs: 8000, headers: { accept: "application/json" } });
          if (pRes.ok) {
            const p = await pRes.json() as Record<string, unknown>;
            const name = p["name"] as Record<string, unknown> | undefined;
            const given = (name?.["given-names"] as Record<string, unknown> | undefined)?.value;
            const family = (name?.["family-name"] as Record<string, unknown> | undefined)?.value;
            const fullName = [given, family].filter(Boolean).join(" ");
            if (fullName) findings.push(mkFinding("orcid", { key: `name_${orcidId}`, label: "Researcher name", value: fullName, sourceUrl: profileUrl }));
          }
        } catch { /* ignore */ }

        findings.push(mkFinding("orcid", { key: `orcid_${orcidId}`, label: "ORCID profile", value: profileUrl, entityType: "url", sourceUrl: profileUrl }));
      }

      return { state: "completed", findings };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
