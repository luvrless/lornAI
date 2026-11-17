import Link from "next/link";
import { registryStats } from "@/lib/sources/registry";
import { Icon, ICONS, Logo } from "@/components/ui";

const FEATURES = [
  { icon: ICONS.radar, t: "Unified investigation engine", d: "One input box auto-detects email, phone, username, domain, IP, URL, hash or wallet and fans out to every eligible source concurrently." },
  { icon: ICONS.bolt, t: "Real keyless sources", d: "DNS, RDAP/WHOIS, Certificate Transparency, TLS, HTTP fingerprinting, IP/ASN geo, DNSBL reputation, phone metadata and 30+ username platforms — all keyless." },
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
      <header className="sticky top-0 z-30 px-4 pt-4">
        <div className="glass mx-auto flex max-w-6xl items-center justify-between rounded-full py-2 pl-4 pr-2">
          <Link href="/" aria-label="lorn.lol home"><Logo size={30} /></Link>
          <nav className="flex items-center gap-1 text-sm">
            {[ ["/docs", "Docs"], ["/sources", "Sources"], ["/tree", "Tree"] ].map(([href, label]) => (
              <Link key={href} href={href} className="hidden rounded-full px-3.5 py-2 text-muted transition-colors hover:bg-white/[0.05] hover:text-white sm:block">{label}</Link>
            ))}
            <Link href="/login" className="btn pill ml-1 !border-transparent !bg-transparent !shadow-none hover:!bg-white/[0.06]">Sign in</Link>
            <Link href="/api/auth/guest?to=/overview" className="btn-primary pill">Continue as guest</Link>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-20 text-center sm:pt-28">
          <div className="chip pill mx-auto mb-7 w-fit animate-rise !bg-white/[0.04] !px-3.5 !py-1.5 backdrop-blur">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            100% free · public-source · defensive OSINT
          </div>
          <h1 className="text-gradient-soft mx-auto max-w-4xl animate-rise text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[68px]">
            The open intelligence<br /><span className="text-gradient">workspace for investigators</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl animate-rise text-pretty text-[17px] leading-relaxed text-muted sm:text-lg">
            lorn.lol runs a unified engine across {stats.total}+ modular intelligence sources — resolving infrastructure, exposure and public footprint from a single identifier.
          </p>
          <div className="mt-10 flex animate-rise flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/api/auth/guest?to=/investigate" className="btn-primary pill group px-7 py-3 text-[15px]">Start investigating <Icon d={ICONS.arrowRight} className="h-4 w-4 transition-transform duration-300 ease-ios group-hover:translate-x-0.5" /></Link>
            <Link href="/sources" className="btn pill px-7 py-3 text-[15px]">Browse sources</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="panel grid grid-cols-2 divide-white/[0.06] overflow-hidden sm:grid-cols-4 sm:divide-x">
          {[{ k: `${stats.total}`, v: "Registered sources" }, { k: `${stats.integrated}`, v: "Live keyless adapters" }, { k: `${stats.requires_key}`, v: "Key-ready integrations" }, { k: "0", v: "Fabricated results" }].map((s) => (
            <div key={s.v} className="p-6 text-center"><div className="text-gradient-soft text-[36px] font-semibold leading-none tracking-tight tabular-nums">{s.k}</div><div className="mt-2 text-sm text-muted">{s.v}</div></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="mx-auto max-w-2xl text-center"><div className="eyebrow">Platform</div><h2 className="text-gradient-soft mt-3 text-[32px] font-semibold tracking-tight sm:text-[40px]">A real engine, not a mockup</h2></div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => <div key={f.t} className="panel panel-hover group p-6"><div className="icon-tile mb-5 h-11 w-11"><Icon d={f.icon} className="h-5 w-5" /></div><h3 className="text-[16px] font-semibold tracking-tight">{f.t}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p></div>)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-4 md:grid-cols-3">{STEPS.map((s) => <div key={s.n}><div className="mono text-sm text-accent-sky">{s.n}</div><div className="divider my-4" /><h3 className="font-semibold tracking-tight">{s.t}</h3><p className="mt-1.5 text-sm leading-relaxed text-muted">{s.d}</p></div>)}</div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 px-8 py-16 text-center"><h2 className="text-gradient-soft relative text-[30px] font-semibold tracking-tight sm:text-[38px]">Start investigating in seconds</h2><p class="relative mx-auto mt-3 max-w-md text-muted">Free forever. No account required.</p><div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link href="/api/auth/guest?to=/investigate" className="btn-primary pill px-7 py-3 text-[15px]">Continue as guest</Link><Link href="/docs" className="btn pill px-7 py-3 text-[15px]">Read the docs</Link></div></div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-12"><div className="divider mb-8" /><div className="flex flex-col items-center justify-between gap-4 sm:flex-row"><Logo size={26} /><p className="text-center text-sm text-faint">For lawful OSINT &amp; defensive research only. Not a background-check service.</p></div></footer>
    </div>
  );
}
