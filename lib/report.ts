import type { Investigation, Finding } from "./types";
import { allFindings } from "./graph";
import { metaById } from "./sources/registry";

export function reportJSON(inv: Investigation): string {
  return JSON.stringify(
    {
      platform: "lorn.lol",
      generatedAt: new Date().toISOString(),
      investigation: {
        id: inv.id,
        input: inv.input,
        identifierType: inv.identifierType,
        normalized: inv.normalized,
        createdAt: inv.createdAt,
        durationMs: inv.durationMs,
        stats: inv.stats,
      },
      sources: inv.results.map((r) => ({
        source: r.sourceId,
        name: metaById(r.sourceId)?.name || r.sourceId,
        state: r.state,
        durationMs: r.durationMs,
        message: r.message,
        findings: r.findings,
      })),
    },
    null,
    2
  );
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function reportCSV(inv: Investigation): string {
  const rows: string[][] = [
    ["source", "source_name", "state", "key", "label", "value", "confidence", "source_url", "collected_at"],
  ];
  for (const r of inv.results) {
    const name = metaById(r.sourceId)?.name || r.sourceId;
    if (r.findings.length === 0) {
      rows.push([r.sourceId, name, r.state, "", "", r.message || "", "", "", r.finishedAt || ""]);
    }
    for (const f of r.findings) {
      rows.push([
        r.sourceId,
        name,
        r.state,
        f.key,
        f.label,
        f.sensitive ? "[redacted sensitive]" : f.value,
        f.confidence.toFixed(2),
        f.sourceUrl || "",
        f.collectedAt,
      ]);
    }
  }
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function findingsByCategory(inv: Investigation): Record<string, Finding[]> {
  const out: Record<string, Finding[]> = {};
  for (const f of allFindings(inv)) {
    const cat = metaById(f.sourceId)?.category || "other";
    (out[cat] ||= []).push(f);
  }
  return out;
}
