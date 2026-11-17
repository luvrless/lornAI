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
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-ink-950/70 px-3 py-2">
          <svg className="h-4 w-4 flex-none text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branches, intelligence categories, tools (e.g. crt.sh, WHOIS, company, breach)..."
            className="mono flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-muted hover:text-white">Clear</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="btn !py-1.5 text-xs">Expand All</button>
          <button onClick={collapseAll} className="btn !py-1.5 text-xs">Collapse</button>
        </div>
      </div>

      {/* Mindmap / Tree viewer */}
      <div className="panel p-5 overflow-x-auto">
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
    <div className={`relative ${level > 0 ? "ml-6 border-l border-white/10 pl-3 my-1" : ""}`}>
      <div className="flex items-center gap-2 group py-0.5">
        {hasChildren ? (
          <button
            onClick={() => toggle(node.id)}
            className="flex h-5 w-5 items-center justify-center rounded border border-white/10 bg-white/5 text-[11px] text-muted hover:border-white/20 hover:text-white"
          >
            {isExpanded ? "−" : "+"}
          </button>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-accent-blue/80 ml-1.5 mr-1" />
        )}

        <span
          onClick={() => (hasChildren ? toggle(node.id) : handleLaunch())}
          className={`cursor-pointer transition select-none ${
            level === 0
              ? "text-base font-bold text-accent-sky"
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
          <span className="chip !py-0 !px-1.5 text-[10px] !bg-emerald-500/10 !text-emerald-300 border-emerald-500/20">
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
        <div className="mt-0.5">
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
