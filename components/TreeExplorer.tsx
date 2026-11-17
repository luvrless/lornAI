"use client";
import { useState, useMemo } from "react";
import { OSINT_FRAMEWORK_TREE, TreeNode } from "@/lib/treeData";
import { useRouter } from "next/navigation";

export function TreeExplorer() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    root: true,
    username: true,
    email: true,
    domain: true,
    ip: true,
    business: true,
  });

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    const traverse = (node: TreeNode) => {
      all[node.id] = true;
      node.children?.forEach(traverse);
    };
    traverse(OSINT_FRAMEWORK_TREE);
    setExpanded(all);
  };

  const collapseAll = () => {
    setExpanded({ root: true });
  };

  // Filter tree nodes if search query provided
  const filteredTree = useMemo(() => {
    if (!search.trim()) return OSINT_FRAMEWORK_TREE;
    const q = search.toLowerCase();

    function filterNode(node: TreeNode): TreeNode | null {
      const match = node.name.toLowerCase().includes(q) || (node.description && node.description.toLowerCase().includes(q));
      if (node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter((c): c is TreeNode => c !== null);
        if (filteredChildren.length > 0 || match) {
          return { ...node, children: filteredChildren };
        }
      }
      return match ? node : null;
    }

    return filterNode(OSINT_FRAMEWORK_TREE) || { id: "empty", name: "No matches found", children: [] };
  }, [search]);

  return (
    <div className="space-y-4">
      {/* Top search & control bar */}
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-2.5">
        <div className="searchbar w-full min-w-0 flex-1 py-2.5 sm:w-auto sm:min-w-[220px]">
          <svg className="h-4 w-4 flex-none text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branches, intelligence categories, tools (e.g. crt.sh, WHOIS, company, breach)..."
            className="mono min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          {search && (
            <button onClick={() => setSearch("")} className="btn-ghost">Clear</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="btn text-xs">Expand All</button>
          <button onClick={collapseAll} className="btn text-xs">Collapse</button>
        </div>
      </div>

      {/* Mindmap / Tree viewer */}
      <div className="panel overflow-x-auto p-5 sm:p-6">
        <div className="font-mono text-sm leading-relaxed">
          <RenderNode node={filteredTree} level={0} expanded={expanded} toggle={toggle} router={router} searchActive={Boolean(search.trim())} />
        </div>
      </div>
    </div>
  );
}

function RenderNode({
  node,
  level,
  expanded,
  toggle,
  router,
  searchActive,
}: {
  node: TreeNode;
  level: number;
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
  router: any;
  searchActive: boolean;
}) {
  const isExpanded = searchActive || Boolean(expanded[node.id]);
  const hasChildren = node.children && node.children.length > 0;

  const handleLaunch = () => {
    if (node.identifierType) {
      router.push(`/investigate?type=${node.identifierType}`);
    } else if (node.url) {
      window.open(node.url, "_blank");
    }
  };

  return (
    <div className={`relative ${level > 0 ? "my-0.5 ml-6 border-l border-white/[0.08] pl-3" : ""}`}>
      <div className="group flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors duration-200 hover:bg-white/[0.03]">
        {hasChildren ? (
          <button
            onClick={() => toggle(node.id)}
            className="flex h-5 w-5 flex-none items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted transition hover:border-white/20 hover:text-white"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            <svg viewBox="0 0 24 24" className={`h-3 w-3 transition-transform duration-300 ease-ios ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        ) : (
          <span className="ml-1.5 mr-1 h-1.5 w-1.5 flex-none rounded-full bg-accent-blue/80 shadow-[0_0_8px_rgba(91,140,255,0.8)]" />
        )}

        <span
          onClick={() => (hasChildren ? toggle(node.id) : handleLaunch())}
          className={`cursor-pointer transition select-none ${
            level === 0
              ? "text-gradient text-base font-bold"
              : level === 1
              ? "text-sm font-semibold text-white"
              : hasChildren
              ? "text-sm font-medium text-slate-300 group-hover:text-white"
              : "text-xs text-muted group-hover:text-accent-sky"
          }`}
        >
          {node.name}
        </span>

        {node.type === "source" && (
          <span className="chip !border-emerald-500/20 !bg-emerald-500/10 !px-1.5 !py-0 text-[10px] !text-emerald-300">
            Integrated
          </span>
        )}

        {node.type === "tool" && node.url && (
          <a
            href={node.url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-accent-blue opacity-0 group-hover:opacity-100 transition hover:underline"
          >
            ↗ open tool
          </a>
        )}

        {node.description && (
          <span className="hidden sm:inline text-[11px] text-faint ml-2 truncate max-w-sm">
            — {node.description}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-0.5 animate-fadein">
          {node.children!.map((child) => (
            <RenderNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              toggle={toggle}
              router={router}
              searchActive={searchActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
