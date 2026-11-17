import Link from "next/link";
import { Icon, ICONS, Logo } from "@/components/ui";

export const runtime = "nodejs";

export default function DocsPage() {
  return (
    <div className="relative min-h-screen">
      <div className="grid-fade pointer-events-none absolute inset-x-0 top-0 h-[480px]" aria-hidden="true" />
      <header className="sticky top-0 z-30 px-4 pt-4">
        <div className="glass mx-auto flex max-w-3xl items-center justify-between rounded-full py-2 pl-4 pr-2">
          <Link href="/" aria-label="lorn.lol home">
            <Logo size={28} />
          </Link>
          <Link href="/" className="btn pill !py-1.5 text-xs">
            <Icon d={ICONS.arrowLeft} className="h-3.5 w-3.5" strokeWidth={2.2} />
            Home
          </Link>
        </div>
      </header>

      <div className="relative mx-auto max-w-3xl px-5 py-16">
        <div className="animate-rise">
          <div className="eyebrow">Documentation</div>
          <h1 className="text-gradient-soft mt-3 text-[36px] font-semibold tracking-tight sm:text-[44px]">Documentation</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-muted">
            lorn.lol is a modular, public-source OSINT platform for lawful, defensive investigations.
          </p>
        </div>

        <section className="stagger mt-10 space-y-3">
          <Block icon={ICONS.sparkle} title="Getting started">
            Create an account (the first account becomes administrator), then open the Investigate console and submit any identifier —
            email, phone, username, domain, IP, URL, file hash or crypto wallet. The engine auto-detects the type and runs every eligible source concurrently with live progress.
          </Block>
          <Block icon={ICONS.bolt} title="Live keyless sources">
            DNS records, RDAP/WHOIS, Certificate Transparency (crt.sh), TLS certificates, HTTP/tech fingerprinting, reverse DNS,
            IP geolocation & ASN, DNSBL reputation, phone metadata, Bitcoin address activity and username discovery across 30+ platforms all run without any API key.
          </Block>
          <Block icon={ICONS.key} title="Key-ready sources">
            100+ additional providers (VirusTotal, Shodan, HIBP, SecurityTrails, AbuseIPDB and more) are registered with honest status.
            They execute the moment you configure their credentials as environment variables — no fabricated results in between.
          </Block>
          <Block icon={ICONS.lock} title="Breach exposure & privacy">
            Password exposure checks use HIBP Pwned Passwords k-anonymity (only a 5-char SHA-1 prefix leaves the server). The platform
            never retrieves stolen credentials, never performs facial recognition, and redacts sensitive findings by default.
          </Block>
          <Block icon={ICONS.code} title="API">
            Every capability is available over a versioned REST API with scoped keys. See the <Link href="/api-dev" className="link">API & Developers</Link> page in the console.
          </Block>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/register" className="btn-primary pill px-6 py-2.5">Create account</Link>
          <Link href="/sources" className="btn pill px-6 py-2.5">Browse sources</Link>
        </div>
      </div>
    </div>
  );
}

function Block({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="panel panel-hover flex gap-4 p-6">
      <div className="icon-tile h-10 w-10">
        <Icon d={icon} className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}
