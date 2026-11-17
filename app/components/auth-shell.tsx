import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

const POINTS = [
  "One identifier in — every eligible source, concurrently",
  "Real, traceable findings. Nothing fabricated",
  "Server-side credentials and SSRF-guarded requests",
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div className="grid-fade pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden="true" />

      <div className="relative grid w-full max-w-[960px] items-center gap-10 lg:grid-cols-[1fr_420px]">
        {/* brand side (desktop) */}
        <div className="hidden animate-rise lg:block">
          <Link href="/" className="inline-flex">
            <Logo size={36} />
          </Link>
          <h2 className="text-gradient-soft mt-10 text-[40px] font-semibold leading-[1.08] tracking-tight">
            The open intelligence
            <br />
            <span className="text-gradient">workspace.</span>
          </h2>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
            Lawful, defensive OSINT across public sources — built for investigators who need answers they can trust.
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm text-muted">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent-blue/15 ring-1 ring-accent-blue/30">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-accent-sky" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* form card */}
        <div className="mx-auto w-full max-w-[420px]">
          <Link href="/" className="mb-8 flex justify-center lg:hidden">
            <Logo size={34} />
          </Link>
          <div className="panel animate-rise p-7 shadow-lift sm:p-8" style={{ animationDelay: "60ms" }}>
            <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
          <p className="mt-6 text-center text-xs text-faint">
            For lawful OSINT &amp; defensive research only.
          </p>
        </div>
      </div>
    </div>
  );
}
