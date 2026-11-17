import Link from "next/link";

export const runtime = "nodejs";

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/" className="link text-sm">← Home</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Documentation</h1>
      <p className="mt-2 text-muted">lorn.lol is a modular, public-source OSINT platform for lawful, defensive investigations.</p>

      <section className="mt-8 space-y-4">
        <Block title="Getting started">
          Create an account (the first account becomes administrator), then open the Investigate console and submit any identifier —
          email, phone, username, domain, IP, URL, file hash or crypto wallet. The engine auto-detects the type and runs every eligible source concurrently with live progress.
        </Block>
        <Block title="Live keyless sources">
          DNS records, RDAP/WHOIS, Certificate Transparency (crt.sh), TLS certificates, HTTP/tech fingerprinting, reverse DNS,
          IP geolocation & ASN, DNSBL reputation, phone metadata, Bitcoin address activity and username discovery across 30+ platforms all run without any API key.
        </Block>
        <Block title="Key-ready sources">
          100+ additional providers (VirusTotal, Shodan, HIBP, SecurityTrails, AbuseIPDB and more) are registered with honest status.
          They execute the moment you configure their credentials as environment variables — no fabricated results in between.
        </Block>
        <Block title="Breach exposure & privacy">
          Password exposure checks use HIBP Pwned Passwords k-anonymity (only a 5-char SHA-1 prefix leaves the server). The platform
          never retrieves stolen credentials, never performs facial recognition, and redacts sensitive findings by default.
        </Block>
        <Block title="API">
          Every capability is available over a versioned REST API with scoped keys. See the <Link href="/api-dev" className="link">API & Developers</Link> page in the console.
        </Block>
      </section>

      <div className="mt-10 flex gap-3">
        <Link href="/register" className="btn-primary">Create account</Link>
        <Link href="/sources" className="btn">Browse sources</Link>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1.5 text-sm text-muted">{children}</p>
    </div>
  );
}
