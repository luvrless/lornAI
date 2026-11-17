import Link from "next/link";
import { registryStats } from "@/lib/sources/registry";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet shadow-glow">
        <div className="absolute inset-0 flex items-center justify-center font-bold text-white">
          l
        </div>
      </div>
      <span className="text-lg font-semibold tracking-tight">
        lorn<span className="text-accent-sky">.lol</span>
      </span>
    </div>
  );
}

const FEATURES = [
  { t: "Unified investigation engine", d: "One input box auto-detects email, phone, username, domain, IP, URL, hash or wallet and fans out to every eligible source concurrently." },
  { t: "Real keyless sources", d: "DNS, RDAP/WHOIS, Certificate Transparency, TLS, HTTP fingerprinting, IP/ASN geo, DNSBL reputation, phone metadata and 30+ username platforms — no API keys required." },
  { t: "Live per-source progress", d: "Server-sent events stream each source's state: waiting, running, completed, no-results, rate-limited or failed. Nothing is ever faked." },
  { t: "Breach exposure, done right", d: "Privacy-preserving k-anonymity password checks and defensive breach-notification metadata. Never leaked secrets, never stolen credentials." },
  { t: "Cases & evidence graph", d: "Organize investigations into cases, correlate entities and explore an evidence-linked relationship graph built only from observed facts." },
  { t: "Developer API", d: "A versioned REST API with scoped keys drives the exact same engine as the dashboard. Export findings as JSON or CSV." },
];

export default function Landing() {
  const stats = registryStats();
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/docs" className="hidden px-3 py-2 text-muted hover:text-white sm:block">
              Docs
            </Link>
            <Link href="/sources" className="hidden px-3 py-2 text-muted hover:text-white sm:block">
              Sources
            </Link>
            <Link href="/tree" className="hidden px-3 py-2 text-muted hover:text-white sm:block">
              Tree
            </Link>
            <Link href="/login" className="btn">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 text-center">
          <div className="chip mx-auto mb-6 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulseglow" />
            100% free · public-source · defensive OSINT
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            The open intelligence
            <br />
            <span className="bg-gradient-to-r from-accent-sky via-accent-blue to-accent-violet bg-clip-text text-transparent">
              workspace for investigators
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted">
            lorn.lol runs a unified engine across {stats.total}+ modular
            intelligence sources — resolving infrastructure, exposure and public
            footprint from a single identifier. Every result traces back to a
            real source. Nothing is invented.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Link href={authed ? "/investigate" : "/register"} className="btn-primary px-6 py-3 text-base">
              Start an investigation
            </Link>
            <Link href="/sources" className="btn px-6 py-3 text-base">
              Browse sources
            </Link>
          </div>

          {/* Search preview */}
          <div className="panel mx-auto mt-14 max-w-3xl p-2 text-left shadow-glass">
            <div className="flex items-center gap-3 rounded-lg bg-ink-950/70 px-4 py-3.5">
              <svg className="h-5 w-5 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span className="mono text-sm text-muted">
                example.com
                <span className="ml-0.5 inline-block h-4 w-px animate-pulseglow bg-accent-sky align-middle" />
              </span>
              <span className="ml-auto chip">domain detected</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4">
              {["DNS records", "RDAP / WHOIS", "CT subdomains", "TLS cert"].map((s) => (
                <div key={s} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-muted">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-blue" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: `${stats.total}`, v: "Registered sources" },
            { k: `${stats.integrated}`, v: "Live keyless adapters" },
            { k: `${stats.requires_key}`, v: "Key-ready integrations" },
            { k: "0", v: "Fabricated results" },
          ].map((s) => (
            <div key={s.v} className="panel p-5">
              <div className="text-3xl font-semibold tracking-tight">{s.k}</div>
              <div className="mt-1 text-sm text-muted">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">A real engine, not a mockup</h2>
        <p className="mt-2 max-w-2xl text-muted">
          Each module has working backend functionality. Sources that need
          credentials say so plainly — and run the moment a key is configured.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="panel p-6 transition hover:border-white/15">
              <div className="mb-3 h-9 w-9 rounded-lg bg-gradient-to-br from-accent-blue/30 to-accent-violet/30 ring-1 ring-white/10" />
              <h3 className="font-medium">{f.t}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="panel grid gap-6 p-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Built for lawful, defensive use</h2>
            <p className="mt-3 text-muted">
              lorn.lol is engineered for authorized OSINT and security research.
              It queries only public and consented sources, runs every
              integration server-side, and redacts sensitive exposure by
              default.
            </p>
          </div>
          <ul className="grid gap-2.5 text-sm">
            {[
              "No stolen-credential retrieval, ever",
              "k-anonymity password exposure checks",
              "SSRF-guarded outbound requests",
              "Server-side credentials, never in the browser",
              "No facial recognition or private tracking",
              "GDPR-style data minimization & deletion controls",
            ].map((x) => (
              <li key={x} className="flex items-start gap-2.5">
                <svg className="mt-0.5 h-4 w-4 flex-none text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span className="text-muted">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <Logo />
          <p className="text-sm text-faint">
            For lawful OSINT & defensive research only. Not a background-check service.
          </p>
        </div>
      </footer>
    </div>
  );
}
