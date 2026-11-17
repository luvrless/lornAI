import type { Adapter, Finding } from "../../types";
import { targetHost, fetchWithTimeout, SourceError } from "../http";
import { entityFinding, mkFinding } from "../util";

interface CrtRow {
  name_value?: string;
  common_name?: string;
  issuer_name?: string;
  not_before?: string;
  not_after?: string;
}

export const crtshAdapter: Adapter = {
  meta: {
    id: "crtsh-ct",
    name: "Certificate Transparency (crt.sh)",
    category: "certificates",
    description:
      "Enumerates subdomains and issued certificates from public Certificate Transparency logs via crt.sh.",
    status: "integrated",
    supports: ["domain", "email", "url"],
    docsUrl: "https://crt.sh/",
    authRequired: false,
    privacy: "public",
    rateLimit: "Be gentle; shared public service",
  },
  canRun: ({ identifierType, normalized }) =>
    !!targetHost(identifierType, normalized),
  async run({ identifierType, normalized, signal }) {
    const host = targetHost(identifierType, normalized);
    if (!host) throw new SourceError("no host", "failed");
    const parts = host.split(".");
    const regDomain = parts.length > 2 ? parts.slice(-2).join(".") : host;
    const res = await fetchWithTimeout(
      `https://crt.sh/?q=%25.${encodeURIComponent(regDomain)}&output=json`,
      { signal, timeoutMs: 20000 }
    );
    if (res.status === 429) throw new SourceError("rate limited", "rate_limited");
    if (!res.ok) throw new SourceError(`crt.sh HTTP ${res.status}`, "unavailable");
    const text = await res.text();
    let rows: CrtRow[] = [];
    try {
      rows = JSON.parse(text);
    } catch {
      return { state: "no_results", findings: [], message: "No CT entries" };
    }

    const subs = new Set<string>();
    const issuers = new Set<string>();
    for (const r of rows) {
      (r.name_value || "").split("\n").forEach((n) => {
        const name = n.trim().toLowerCase().replace(/^\*\./, "");
        if (name && name.endsWith(regDomain) && !name.includes(" ")) subs.add(name);
      });
      if (r.issuer_name) {
        const o = /O=([^,]+)/.exec(r.issuer_name)?.[1];
        if (o) issuers.add(o.trim());
      }
    }

    const findings: Finding[] = [];
    [...subs]
      .sort()
      .slice(0, 400)
      .forEach((s) =>
        findings.push(
          entityFinding(
            "crtsh-ct",
            "subdomain",
            "Subdomain",
            s,
            "domain",
            0.85,
            `https://crt.sh/?q=${encodeURIComponent(s)}`
          )
        )
      );
    [...issuers].slice(0, 15).forEach((i) =>
      findings.push(mkFinding("crtsh-ct", { key: "cert_issuer", label: "Certificate issuer", value: i, confidence: 0.8 }))
    );

    if (findings.length === 0)
      return { state: "no_results", findings: [], message: "No certificates logged" };
    return {
      state: "completed",
      findings,
      message: `${subs.size} unique names in CT logs`,
      raw: { uniqueSubdomains: subs.size, issuers: [...issuers] },
    };
  },
};
