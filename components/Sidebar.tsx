"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/types";

type Item = { href: string; label: string; icon: React.ReactNode; admin?: boolean };

const I = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
    <path d={d} />
  </svg>
);

const NAV: Item[] = [
  { href: "/overview", label: "Overview", icon: I("M3 12l9-9 9 9M5 10v10h14V10") },
  { href: "/investigate", label: "Investigate", icon: I("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-4.3-4.3") },
  { href: "/tree", label: "Framework Tree", icon: I("M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83") },
  { href: "/sources", label: "Data Sources", icon: I("M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7") },
  { href: "/cases", label: "Cases", icon: I("M4 7h16v13H4zM9 7V4h6v3") },
  { href: "/graph", label: "Graph Analysis", icon: I("M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 16l8-6M18 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-2 2-6-2") },
  { href: "/saved", label: "Saved Results", icon: I("M6 4h12v16l-6-4-6 4z") },
  { href: "/history", label: "History", icon: I("M12 7v5l3 3M3 12a9 9 0 1 0 2.6-6.3M3 4v4h4") },
  { href: "/api-dev", label: "API & Developers", icon: I("M8 9l-4 3 4 3m8-6 4 3-4 3M14 5l-4 14") },
  { href: "/settings", label: "Settings", icon: I("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7") },
  { href: "/admin", label: "Admin", icon: I("M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"), admin: true },
];

export function Sidebar({ role, email, displayName }: { role: Role; email: string; displayName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const items = NAV.filter((i) => !i.admin || role === "admin");

  return (
    <>
      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/5 bg-ink-950/70 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/overview" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-accent-blue to-accent-violet" />
          <span className="font-semibold">lorn<span className="text-accent-sky">.lol</span></span>
        </Link>
        <button className="btn px-2.5 py-1.5" onClick={() => setOpen((o) => !o)} aria-label="menu">
          <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth="2" fill="none"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-white/5 bg-ink-900/80 backdrop-blur-xl transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-white/5 px-5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet shadow-glow" />
          <span className="font-semibold tracking-tight">lorn<span className="text-accent-sky">.lol</span></span>
          <span className="chip ml-auto !px-2 !py-0.5 text-[10px]">beta</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-accent-blue/15 text-white ring-1 ring-accent-blue/30"
                    : "text-muted hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className={active ? "text-accent-sky" : ""}>{item.icon}</span>
                {item.label}
                {item.admin && <span className="ml-auto chip !px-1.5 !py-0 text-[9px]">admin</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="mb-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulseglow" />
            All systems operational
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-2.5 py-2">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-sm font-semibold text-white">
              {displayName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{displayName}</div>
              <div className="truncate text-xs text-faint">{email}</div>
            </div>
            <button onClick={logout} title="Sign out" className="rounded-md p-1.5 text-faint hover:bg-white/5 hover:text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" strokeWidth="2" fill="none"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /></svg>
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
