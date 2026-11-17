import type { Adapter, Finding } from "../../types";
import { targetHost, fetchWithTimeout, SourceError } from "../http";
import { mkFinding } from "../util";

interface RdapEvent { eventAction?: string; eventDate?: string }
interface RdapEntity { roles?: string[]; vcardArray?: unknown[] }
interface RdapResp {
  ldhName?: string;
  status?: string[];
  events?: RdapEvent[];
  entities?: RdapEntity[];
  nameservers?: { ldhName?: string }[];
  secureDNS?: { delegationSigned?: boolean };
}

function registrarName(entities: RdapEntity[] = []): string | null {
  const reg = entities.find((e) => e.roles?.includes("registrar"));
  if (!reg?.vcardArray) return null;
  const vcard = reg.vcardArray[1] as unknown[];
  if (!Array.isArray(vcard)) return null;
  for (const item of vcard) {
    if (Array.isArray(item) && item[0] === "fn") return String(item[3]);
  }
  return null;
}

export const rdapDomainAdapter: Adapter = {
  meta: {
    id: "rdap-domain",
    name: "RDAP / WHOIS (Domain)",
    category: "whois",
    description:
      "Queries the global RDAP bootstrap for authoritative registration data: registrar, status, key dates, nameservers and DNSSEC.",
    status: "integrated",
    supports: ["domain", "email", "url"],
    docsUrl: "https://about.rdap.org/",
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType, normalized }) =>
    !!targetHost(identifierType, normalized),
  async run({ identifierType, normalized, signal }) {
    const host = targetHost(identifierType, normalized);
    if (!host) throw new SourceError("no host", "failed");
    // Use the registration domain (last two labels) for RDAP
    const parts = host.split(".");
    const regDomain = parts.length > 2 ? parts.slice(-2).join(".") : host;
    const res = await fetchWithTimeout(`https://rdap.org/domain/${regDomain}`, {
      signal,
      timeoutMs: 12000,
    });
    if (res.status === 404)
      return { state: "no_results", findings: [], message: "Domain not found in RDAP" };
    if (res.status === 429) throw new SourceError("rate limited", "rate_limited");
    if (!res.ok) throw new SourceError(`RDAP HTTP ${res.status}`, "unavailable");
    const data = (await res.json()) as RdapResp;
    const findings: Finding[] = [];

    const reg = registrarName(data.entities);
    if (reg)
      findings.push(mkFinding("rdap-domain", { key: "registrar", label: "Registrar", value: reg, confidence: 0.95 }));

    (data.status || []).forEach((s) =>
      findings.push(mkFinding("rdap-domain", { key: "domain_status", label: "Status", value: s, confidence: 0.9 }))
    );

    (data.events || []).forEach((ev) => {
      if (ev.eventAction && ev.eventDate)
        findings.push(
          mkFinding("rdap-domain", {
            key: `event_${ev.eventAction.replace(/\s+/g, "_")}`,
            label: `Date: ${ev.eventAction}`,
            value: ev.eventDate,
            confidence: 0.95,
            publishedAt: ev.eventDate,
          })
        );
    });

    (data.nameservers || []).forEach((ns) => {
      if (ns.ldhName)
        findings.push(mkFinding("rdap-domain", { key: "nameserver", label: "Nameserver", value: ns.ldhName.toLowerCase(), confidence: 0.9 }));
    });

    if (data.secureDNS)
      findings.push(
        mkFinding("rdap-domain", {
          key: "dnssec",
          label: "DNSSEC",
          value: data.secureDNS.delegationSigned ? "signed" : "unsigned",
          confidence: 0.9,
        })
      );

    if (findings.length === 0)
      return { state: "no_results", findings: [], message: "No registration data", raw: data };
    return { state: "completed", findings, raw: data };
  },
};
