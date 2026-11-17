"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Graph, GraphNode } from "@/lib/graph";

type Row = { id: string; input: string; normalized: string; identifierType: string };

const TYPE_COLOR: Record<string, string> = {
  root: "#6366f1",
  domain: "#38bdf8",
  ip: "#f59e0b",
  url: "#8b5cf6",
  email: "#34d399",
  username: "#f472b6",
  wallet: "#facc15",
  attribute: "#64748b",
};

export function GraphView({ investigations }: { investigations: Row[] }) {
  const [selected, setSelected] = useState(investigations[0]?.id || "");
  const [graph, setGraph] = useState<Graph | null>(null);
  const [active, setActive] = useState<GraphNode | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!selected) return;
    setGraph(null);
    fetch(`/api/investigations/${selected}/graph`)
      .then((r) => r.json())
      .then((d) => setGraph(d.graph))
      .catch(() => setGraph(null));
  }, [selected]);

  const layout = useMemo(() => {
    if (!graph) return null;
    const W = 900, H = 600, cx = W / 2, cy = H / 2;
    const root = graph.nodes.find((n) => n.type === "root");
    const others = graph.nodes.filter((n) => n.type !== "root");
    const pos = new Map<string, { x: number; y: number }>();
    if (root) pos.set(root.id, { x: cx, y: cy });
    // group by type ring
    const byType = new Map<string, GraphNode[]>();
    others.forEach((n) => { (byType.get(n.type) || byType.set(n.type, []).get(n.type)!).push(n); });
    const types = [...byType.keys()];
    let idx = 0;
    const total = others.length || 1;
    types.forEach((t, ti) => {
      const ring = 150 + ti * 120;
      const group = byType.get(t)!;
      group.forEach((n, i) => {
        const angle = (idx / total) * Math.PI * 2 + ti * 0.4;
        idx++;
        void i;
        pos.set(n.id, { x: cx + Math.cos(angle) * ring, y: cy + Math.sin(angle) * ring });
      });
    });
    return { W, H, pos };
  }, [graph]);

  function exportJSON() {
    if (!graph) return;
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `graph-${selected}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="panel mb-4 flex flex-wrap items-center gap-2 p-3">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input !w-auto">
          {investigations.length === 0 && <option>No saved investigations</option>}
          {investigations.map((i) => <option key={i.id} value={i.id}>{i.identifierType}: {i.normalized}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2 text-sm text-faint">
          {graph && <span>{graph.nodes.length} nodes · {graph.edges.length} edges</span>}
          <button className="btn !py-1.5" onClick={() => setView({ x: 0, y: 0, k: 1 })}>Reset</button>
          <button className="btn !py-1.5" onClick={exportJSON} disabled={!graph}>Export JSON</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="panel relative overflow-hidden">
          {!graph && <div className="flex h-[600px] items-center justify-center text-sm text-faint">Select an investigation to render its evidence graph.</div>}
          {graph && layout && (
            <svg
              viewBox={`0 0 ${layout.W} ${layout.H}`}
              className="h-[600px] w-full cursor-grab active:cursor-grabbing"
              onWheel={(e) => {
                const k = Math.min(3, Math.max(0.4, view.k * (e.deltaY < 0 ? 1.1 : 0.9)));
                setView((v) => ({ ...v, k }));
              }}
              onMouseDown={(e) => (dragging.current = { x: e.clientX - view.x, y: e.clientY - view.y })}
              onMouseUp={() => (dragging.current = null)}
              onMouseLeave={() => (dragging.current = null)}
              onMouseMove={(e) => {
                if (dragging.current) setView((v) => ({ ...v, x: e.clientX - dragging.current!.x, y: e.clientY - dragging.current!.y }));
              }}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(56, 189, 248, 0.7)" />
                </marker>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                {graph.edges.map((e, i) => {
                  const a = layout.pos.get(e.source);
                  const b = layout.pos.get(e.target);
                  if (!a || !b) return null;
                  const mx = (a.x + b.x) / 2;
                  const my = (a.y + b.y) / 2;
                  return (
                    <g key={i}>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="rgba(56, 189, 248, 0.35)"
                        strokeWidth={1.5}
                        markerEnd="url(#arrow)"
                      />
                      {view.k > 0.7 && (
                        <text
                          x={mx}
                          y={my - 4}
                          fontSize={9}
                          fill="rgba(148, 163, 184, 0.85)"
                          textAnchor="middle"
                          className="mono pointer-events-none select-none bg-ink-950 px-1"
                        >
                          {e.label}
                        </text>
                      )}
                    </g>
                  );
                })}
                {graph.nodes.map((n) => {
                  const p = layout.pos.get(n.id);
                  if (!p) return null;
                  const isRoot = n.type === "root";
                  const r = isRoot ? 24 : 14;
                  const strokeColor = isRoot ? "#818cf8" : (TYPE_COLOR[n.type] || "#38bdf8");
                  return (
                    <g key={n.id} transform={`translate(${p.x} ${p.y})`} className="cursor-pointer group" onClick={() => setActive(n)}>
                      {/* Outer pulsing ring for root */}
                      {isRoot && (
                        <circle r={r + 8} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6} />
                      )}
                      {/* Node circle */}
                      <circle
                        r={r}
                        fill="#0b0f19"
                        stroke={strokeColor}
                        strokeWidth={active?.id === n.id ? 3 : 2}
                        filter={active?.id === n.id || isRoot ? "url(#glow)" : undefined}
                      />
                      {/* Node Center Dot */}
                      <circle r={isRoot ? 8 : 4} fill={strokeColor} opacity={0.9} />
                      {/* Label */}
                      <text
                        x={0}
                        y={r + 14}
                        fontSize={isRoot ? 12 : 10}
                        fill="rgba(241, 245, 249, 0.95)"
                        textAnchor="middle"
                        fontWeight={isRoot ? "bold" : "normal"}
                        className="mono pointer-events-none select-none"
                      >
                        {n.label.length > 22 ? n.label.slice(0, 22) + "…" : n.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        <div className="panel p-4">
          <h2 className="mb-3 font-medium">Node details</h2>
          {active ? (
            <div className="space-y-2 text-sm">
              <div><span className="label">Type</span><div className="mt-0.5">{active.type}</div></div>
              <div><span className="label">Value</span><div className="mono mt-0.5 break-all">{active.label}</div></div>
              <div><span className="label">Confidence</span><div className="mt-0.5">{Math.round(active.confidence * 100)}%</div></div>
              <div>
                <span className="label">Connected via</span>
                <ul className="mt-1 space-y-1">
                  {graph?.edges.filter((e) => e.target === active.id || e.source === active.id).map((e, i) => (
                    <li key={i} className="text-xs text-muted">{e.label} <span className="text-faint">({e.sourceId})</span></li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-faint">Click a node to inspect it. Only evidence-backed relationships are drawn.</p>
          )}
          <div className="mt-4 border-t border-white/5 pt-3">
            <div className="label mb-2">Legend</div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {Object.entries(TYPE_COLOR).map(([t, c]) => (
                <div key={t} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
