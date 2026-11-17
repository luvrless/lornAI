import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, SectionTitle } from "@/components/ui";
import { ApiKeysClient } from "@/components/ApiKeysClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINTS = [
  ["POST", "/api/v1/investigations", "Run an investigation synchronously (optionally save)"],
  ["GET", "/api/v1/investigations", "List your investigations (paginated)"],
  ["GET", "/api/v1/investigations/:id", "Fetch a full investigation"],
  ["GET", "/api/v1/sources", "The full source registry with status"],
  ["GET", "/api/v1/cases", "List your cases"],
];

export default function ApiDevPage() {
  const { user } = getCurrentUser()!;
  const keys = db
    .filter("apikeys", (k) => k.userId === user.id && !k.revoked)
    .map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt }));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Developers" title="API & Developers" subtitle="The same engine the dashboard uses, over a versioned REST API." />
      <ApiKeysClient initial={keys} />

      <div className="panel mt-5 p-5 sm:p-6">
        <SectionTitle>Endpoints</SectionTitle>
        <div className="divide-y divide-white/[0.05]">
          {ENDPOINTS.map(([m, p, d]) => (
            <div key={p + m} className="flex flex-wrap items-center gap-3 py-3">
              <span className={`mono w-12 rounded-md py-0.5 text-center text-[11px] font-medium ring-1 ${m === "GET" ? "bg-sky-500/10 text-sky-300 ring-sky-500/20" : "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"}`}>{m}</span>
              <code className="mono min-w-0 break-all text-sm text-white/90">{p}</code>
              <span className="text-sm text-faint">{d}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel mt-5 p-5 sm:p-6">
        <SectionTitle>Quickstart</SectionTitle>
        <pre className="codeblock">{`# Run an investigation
curl -X POST http://localhost:3000/api/v1/investigations \\
  -H "Authorization: Bearer lorn_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"input":"example.com","save":true}'

# List registered sources
curl http://localhost:3000/api/v1/sources \\
  -H "Authorization: Bearer lorn_sk_..."`}</pre>
      </div>

      <div className="panel mt-5 p-5 sm:p-6">
        <SectionTitle>TypeScript SDK</SectionTitle>
        <pre className="codeblock">{`import { LornClient } from "./sdk";

const lorn = new LornClient({ apiKey: process.env.LORN_API_KEY! });
const inv = await lorn.investigate("8.8.8.8", { save: true });
console.log(inv.stats, inv.results);`}</pre>
        <p className="mt-3 text-xs text-faint">The SDK and a CLI are included in the repository under <code className="mono">sdk/</code> and <code className="mono">cli/</code>.</p>
      </div>

      <div className="panel mt-5 p-5 sm:p-6">
        <SectionTitle>Error model</SectionTitle>
        <p className="text-sm text-muted">All errors return <code className="mono">{"{ error, requestId }"}</code> with an appropriate HTTP status (400 validation, 401 auth, 403 forbidden, 404 not found, 429 rate limited, 502 upstream).</p>
      </div>
    </div>
  );
}
