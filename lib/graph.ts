import type { Investigation, Finding, IdentifierType } from "./types";

export interface GraphNode {
  id: string;
  label: string;
  type: IdentifierType | "root" | "attribute";
  confidence: number;
}
export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  sourceId: string;
  confidence: number;
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Build an evidence graph: only connect entities that an actual source observed.
export function buildGraph(inv: Investigation): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const rootId = `root:${inv.normalized}`;
  nodes.set(rootId, {
    id: rootId,
    label: inv.normalized,
    type: "root",
    confidence: 1,
  });

  for (const res of inv.results) {
    for (const f of res.findings) {
      if (!f.entityType) continue; // only graph entity-type findings
      const nodeId = `${f.entityType}:${f.value}`;
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          label: f.value,
          type: f.entityType,
          confidence: f.confidence,
        });
      }
      edges.push({
        source: rootId,
        target: nodeId,
        label: f.label,
        sourceId: f.sourceId,
        confidence: f.confidence,
      });
    }
  }
  return { nodes: [...nodes.values()], edges };
}

// Deduplicate findings by (key,value), keeping highest confidence and merging sources.
export function dedupeFindings(findings: Finding[]): Finding[] {
  const map = new Map<string, Finding>();
  for (const f of findings) {
    const k = `${f.key}:${f.value.toLowerCase()}`;
    const existing = map.get(k);
    if (!existing || f.confidence > existing.confidence) {
      map.set(k, f);
    }
  }
  return [...map.values()];
}

export function allFindings(inv: Investigation): Finding[] {
  return inv.results.flatMap((r) => r.findings);
}
