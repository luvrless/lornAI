/** @jsxRuntime automatic @jsxImportSource react */
/** Minimal History-API router. */
import { useSyncExternalStore, type ReactNode, type MouseEvent } from "react";

const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
if (typeof window !== "undefined") addEventListener("popstate", notify);

export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search) return;
  replace ? history.replaceState(null, "", to) : history.pushState(null, "", to);
  notify();
  window.scrollTo({ top: 0 });
}

export function useLocation() {
  const path = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => location.pathname + location.search, () => "/");
  const u = new URL(path, "http://x");
  return { pathname: u.pathname, search: u.searchParams };
}

export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean), b = path.split("/").filter(Boolean);
  if (pattern.endsWith("/*")) { if (b.length < a.length - 1) return null; }
  else if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "*") break;
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Link({ to, children, className, onClick: extra, ...rest }: { to: string; children: ReactNode; className?: string } & Record<string, any>) {
  const onClick = (e: MouseEvent) => {
    extra?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} className={className} {...rest} onClick={onClick}>{children}</a>;
}
