import Link from "next/link";
import { registryStats } from "@/lib/sources/registry";
import { Icon, ICONS, Logo } from "@/components/ui";

const FEATURES = [
  { icon: ICONS.radar, t: "Unified investigation engine", d: "One input box auto-detects email, phone, username, domain, IP, URL, hash or wallet and fans out to every eligible source concurrently." },
  { icon: ICONS.bolt, t: "Real keyless sources", d: "DNS, RDAP/WHOIS, Certificate Transparency, TLS, HTTP fingerprinting, IP/ASN geo, DNSBL reputation, phone metadata and 30+ username platforms — no API keys required." },
  { icon: ICONS.sparkle, t: "Live per-source progress", d: "Server-sent events stream each source's state: waiting, running, completed, no-results, rate-limited or failed. Nothing is ever faked." },
  { icon: ICONS.lock, t: "Breach exposure, done right", d: "Privacy-preserving k-anonymity password checks and defensive breach-notification metadata. Never leaked secrets, never stolen credentials." },
  { icon: ICONS.graph, t: "Cases & evidence graph", d: "Organize investigations into cases, correlate entities and explore an evidence-linked relationship graph built only from observed facts." },
  { icon: ICONS.code, t: "Developer API", d: "A versioned REST API with scoped keys drives the exact same engine as the dashboard. Export findings as JSON or CSV." },
];

const STEPS = [
  { n: "01", t: "Enter an identifier", d: "Paste anything — the engine detects its type and normalizes it." },
  { n: "02", t: "Sources run in parallel", d: "Every eligible adapter executes server-side with live progress." },
  { n: "03", t: "Review, save, correlate", d: "Attach findings to cases, export them, or explore the graph." },
];

const SECURITY = [
  "No stolen-credential retrieval, ever",
  "k-anonymity password exposure checks",
  "SSRF-guarded outbound requests",
  "Server-side credentials, never in the browser",
  "No facial recognition or private tracking",
  "GDPR-style data minimization & deletion controls",
];

// Illustrative preview of the console UI (labels only — no data is shown).
const PREVIEW = [
  { s: "DNS records", c: "bg-emerald-400" },
  { s: "RDAP / WHOIS", c: "bg-emerald-400" },
  { s: "CT subdomains", c: "bg-accent-sky" },
  { s: "TLS certificate", c: "bg-accent-sky" },
  { s: "HTTP fingerprint", c: "bg-white/30" },
  { s: "DNSBL reputation", c: "bg-white/30" },
];

export default function Landing() {
  const stats = registryStats();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grid-fade pointer-events-none absolute inset-x-0 top-0 h-[760px]" aria-hidden="true" />

      {/* Nav */}
      <header className="sticky top-0 z-30 px-4 pt-4">
        <div className="glass mx-auto flex max-w-6xl items-center justify-between rounded-full py-2 pl-4 pr-2">
          <Link href="/" aria-label="lorn.lol home">
            <Logo size={30} />
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {[
              ["/docs", "Docs"],
              ["/sources", "Sources"],
              ["/tree", "Tree"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="hidden rounded-full px-3.5 py-2 text-muted transition-colors hover:bg-white/[0.05] hover:text-white sm:block"
              >
                {label}
              </Link>
            ))}
            <Link href="/login" className="btn pill ml-1 !border-transparent !bg-transparent !shadow-none hover:!bg-white/[0.06]">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary pill">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-20 text-center sm:pt-28">
          <div className="chip pill mx-auto mb-7 w-fit animate-rise !bg-white/[0.04] !px-3.5 !py-1.5 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            100% free · public-source · defensive OSINT
          </div>
          <h1
            className="text-gradient-soft mx-auto max-w-4xl animate-rise text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[68px]"
            style={{ animationDelay: "60ms" }}
          >
            The open intelligence
            <br />
            <span className="text-gradient">workspace for investigators</span>
          </h1>
          <p
            className="mx-auto mt-7 max-w-2xl animate-rise text-pretty text-[17px] leading-relaxed text-muted sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            lorn.lol runs a unified engine across {stats.total}+ modular
            intelligence sources — resolving infrastructure, exposure and public
            footprint from a single identifier. Every result traces back to a
            real source. Nothing is invented.
          </p>
          <div className="mt-10 flex animate-rise flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
            <Link href="/register" className="btn-primary pill group px-7 py-3 text-[15px]">
              Start an investigation
              <Icon d={ICONS.arrowRight} className="h-4 w-4 transition-transform duration-300 ease-ios group-hover:translate-x-0.5" strokeWidth={2.2} />
            </Link>
            <Link href="/sources" className="btn pill px-7 py-3 text-[15px]">
              Browse sources
            </Link>
          </div>

          {/* Console preview */}
          <div className="relative mx-auto mt-20 max-w-4xl animate-rise" style={{ animationDelay: "260ms" }}>
            <div
              className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 rounded-[40px] opacity-70 blur-3xl"
              style={{ background: "radial-gradient(60% 60% at 50% 30%, rgba(91,120,255,0.35), transparent 70%)" }}
              aria-hidden="true"
            />
            <div className="panel relative overflow-hidden !rounded-[24px] p-2 text-left shadow-lift">
              <div className="flex items-center gap-1.5 px-3 pb-2 pt-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="mx-auto text-[11px] text-faint">lorn.lol / investigate</span>
              </div>
              <div className="searchbar py-3.5">
                <Icon d={ICONS.search} className="h-5 w-5 text-faint" />
                <span className="mono text-sm text-white/90">
                  example.com
                  <span className="ml-0.5 inline-block h-4 w-px animate-pulseglow bg-accent-sky align-middle" />
                </span>
                <span className="chip ml-auto !border-accent-blue/30 !bg-accent-blue/10 !text-accent-sky">domain detected</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
                {PREVIEW.map((p) => (
                  <div key={p.s} className="tile flex items-center gap-2 px-3 py-2.5 text-xs text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${p.c}`} />
                    {p.s}
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3 pt-1">
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="panel grid grid-cols-2 divide-white/[0.06] overflow-hidden sm:grid-cols-4 sm:divide-x">
          {[
            { k: `${stats.total}`, v: "Registered sources" },
            { k: `${stats.integrated}`, v: "Live keyless adapters" },
            { k: `${stats.requires_key}`, v: "Key-ready integrations" },
            { k: "0", v: "Fabricated results" },
          ].map((s) => (
            <div key={s.v} className="p-6 text-center">
              <div className="text-gradient-soft text-[36px] font-semibold leading-none tracking-tight tabular-nums">{s.k}</div>
              <div className="mt-2 text-sm text-muted">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow">Platform</div>
          <h2 className="text-gradient-soft mt-3 text-[32px] font-semibold tracking-tight sm:text-[40px]">A real engine, not a mockup</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            Each module has working backend functionality. Sources that need
            credentials say so plainly — and run the moment a key is configured.
          </p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="panel panel-hover group p-6">
              <div className="icon-tile mb-5 h-11 w-11 transition-transform duration-500 ease-ios group-hover:scale-105">
                <Icon d={f.icon} className="h-5 w-5" />
              </div>
              <h3 className="text-[16px] font-semibold tracking-tight">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative pl-0 md:pl-2">
              <div className="mono text-sm text-accent-sky">{s.n}</div>
              <div className="divider my-4" />
              <h3 className="font-semibold tracking-tight">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="panel relative grid gap-10 overflow-hidden !rounded-[28px] p-8 sm:p-12 lg:grid-cols-2">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(140,110,255,0.35), transparent 70%)" }}
            aria-hidden="true"
          />
          <div className="relative">
            <div className="icon-tile mb-6 h-12 w-12">
              <Icon d={ICONS.shield} className="h-5 w-5" />
            </div>
            <h2 className="text-gradient-soft text-[30px] font-semibold tracking-tight">Built for lawful, defensive use</h2>
            <p className="mt-4 leading-relaxed text-muted">
              lorn.lol is engineered for authorized OSINT and security research.
              It queries only public and consented sources, runs every
              integration server-side, and redacts sensitive exposure by
              default.
            </p>
          </div>
          <ul className="relative grid content-center gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
            {SECURITY.map((x) => (
              <li key={x} className="tile flex items-center gap-3 px-4 py-3">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-400/30">
                  <Icon d={ICONS.check} className="h-3 w-3 text-emerald-300" strokeWidth={3} />
                </span>
                <span className="text-white/80">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 px-8 py-16 text-center">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(80% 120% at 50% 0%, rgba(91,120,255,0.28), rgba(140,100,255,0.12) 45%, transparent 75%)" }}
            aria-hidden="true"
          />
          <h2 className="text-gradient-soft relative text-[30px] font-semibold tracking-tight sm:text-[38px]">Start investigating in seconds</h2>
          <p className="relative mx-auto mt-3 max-w-md text-muted">Free forever. No API keys needed to get started.</p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary pill px-7 py-3 text-[15px]">Create free account</Link>
            <Link href="/docs" className="btn pill px-7 py-3 text-[15px]">Read the docs</Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-12">
        <div className="divider mb-8" />
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo size={26} />
          <p className="text-center text-sm text-faint">
            For lawful OSINT &amp; defensive research only. Not a background-check service.
          </p>
        </div>
      </footer>
    </div>
  );
}
