"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Role } from "@/lib/types";
import { Logo, LogoMark } from "./ui";

type Item = { href: string; label: string; icon: React.ReactNode; admin?: boolean; group: string };

const I = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <path d={d} />
  </svg>
);

const NAV: Item[] = [
  { group: "Workspace", href: "/overview", label: "Overview", icon: I("M3 12l9-9 9 9M5 10v10h14V10") },
  { group: "Workspace", href: "/investigate", label: "Investigate", icon: I("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-4.3-4.3") },
  { group: "Workspace", href: "/cases", label: "Cases", icon: I("M4 7h16v13H4zM9 7V4h6v3") },
  { group: "Workspace", href: "/graph", label: "Graph Analysis", icon: I("M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 16l8-6M18 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-2 2-6-2") },
  { group: "Workspace", href: "/saved", label: "Saved Results", icon: I("M6 4h12v16l-6-4-6 4z") },
  { group: "Workspace", href: "/history", label: "History", icon: I("M12 7v5l3 3M3 12a9 9 0 1 0 2.6-6.3M3 4v4h4") },
  { group: "Intelligence", href: "/tree", label: "Framework Tree", icon: I("M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83") },
  { group: "Intelligence", href: "/sources", label: "Data Sources", icon: I("M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7") },
  { group: "Account", href: "/api-dev", label: "API & Developers", icon: I("M8 9l-4 3 4 3m8-6 4 3-4 3M14 5l-4 14") },
  { group: "Account", href: "/settings", label: "Settings", icon: I("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7") },
  { group: "Account", href: "/admin", label: "Admin", icon: I("M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"), admin: true },
];

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function Sidebar({ role, email, displayName }: { role: Role; email: string; displayName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState<{ top: number; height: number; visible: boolean }>({ top: 0, height: 0, visible: false });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const items = NAV.filter((i) => !i.admin || role === "admin");
  const groups = Array.from(new Set(items.map((i) => i.group)));
  const activeItem = items.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  // Slide the active-state indicator to the current item.
  useIsoLayoutEffect(() => {
    const el = activeItem ? linkRefs.current[activeItem.href] : null;
    if (!el) {
      setIndicator((s) => ({ ...s, visible: false }));
      return;
    }
    setIndicator({ top: el.offsetTop, height: el.offsetHeight, visible: true });
  }, [activeItem?.href]);

  // Close the mobile drawer on Escape; lock body scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* mobile top bar */}
      <div className="glass sticky top-0 z-40 flex items-center justify-between !rounded-none !border-x-0 !border-t-0 px-4 py-3 lg:hidden">
        <Link href="/overview" className="flex items-center">
          <Logo size={28} />
        </Link>
        <button
          className="btn !rounded-full !px-2.5 !py-2"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
            {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col p-3 transition-transform duration-500 ease-ios lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="glass flex h-full flex-col overflow-hidden rounded-[22px]">
          <div className="flex h-16 items-center gap-2.5 px-4">
            <Link href="/overview" className="flex items-center" onClick={() => setOpen(false)}>
              <Logo size={30} />
            </Link>
            <span className="chip ml-auto !px-2 !py-0.5 text-[10px] uppercase tracking-wider">beta</span>
          </div>
          <div className="divider mx-4" />

          <nav ref={navRef} className="relative flex-1 overflow-y-auto px-2.5 py-3">
            {/* sliding active indicator */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 right-2.5 rounded-xl transition-all duration-500 ease-ios"
              style={{
                top: indicator.top,
                height: indicator.height,
                opacity: indicator.visible ? 1 : 0,
                background: "linear-gradient(180deg, rgba(110,140,255,0.2), rgba(110,140,255,0.1))",
                boxShadow: "inset 0 0 0 1px rgba(130,155,255,0.28), inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px -12px rgba(91,110,255,0.6)",
              }}
            />
            {groups.map((g) => (
              <div key={g} className="mb-3 last:mb-0">
                <div className="label px-3 pb-1.5 pt-1">{g}</div>
                <div className="space-y-0.5">
                  {items
                    .filter((i) => i.group === g)
                    .map((item) => {
                      const active = item.href === activeItem?.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          ref={(el) => {
                            linkRefs.current[item.href] = el;
                          }}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors duration-200 ${
                            active ? "text-white" : "text-muted hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          <span
                            className={`transition-all duration-300 ease-ios ${
                              active ? "text-accent-sky" : "text-faint group-hover:scale-110 group-hover:text-white"
                            }`}
                          >
                            {item.icon}
                          </span>
                          <span className="font-medium">{item.label}</span>
                          {item.admin && <span className="chip ml-auto !px-1.5 !py-0 text-[9px] uppercase tracking-wider">admin</span>}
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-2.5">
            <div className="mb-2 flex items-center gap-2 px-2.5 py-1 text-xs text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              All systems operational
            </div>
            <div className="tile flex items-center gap-2.5 px-2.5 py-2.5">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-sm font-semibold text-white shadow-glow">
                {displayName[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{displayName}</div>
                <div className="truncate text-xs text-faint">{email}</div>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="rounded-lg p-2 text-faint transition hover:bg-white/[0.06] hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /></svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
    </>
  );
}

