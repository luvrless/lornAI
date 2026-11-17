import type { Adapter, Finding } from "../../types";
import { fetchWithTimeout, SourceError } from "../http";
import { mkFinding } from "../util";

interface RdapIpResp {
  handle?: string;
  name?: string;
  type?: string;
  country?: string;
  startAddress?: string;
  endAddress?: string;
  cidr0_cidrs?: { v4prefix?: string; v6prefix?: string; length?: number }[];
  entities?: { roles?: string[]; handle?: string; vcardArray?: unknown[] }[];
  remarks?: { description?: string[] }[];
}

export const rdapIpAdapter: Adapter = {
  meta: {
    id: "rdap-ip",
    name: "RDAP (IP / Network)",
    category: "ip",
    description:
      "Authoritative network registration for an IP: allocation name, network range/CIDR, country and responsible organization.",
    status: "integrated",
    supports: ["ip"],
    docsUrl: "https://about.rdap.org/",
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType }) => identifierType === "ip",
  async run({ normalized, signal }) {
    const res = await fetchWithTimeout(`https://rdap.org/ip/${normalized}`, {
      signal,
      timeoutMs: 12000,
    });
    if (res.status === 404)
      return { state: "no_results", findings: [], message: "No RDAP record" };
    if (res.status === 429) throw new SourceError("rate limited", "rate_limited");
    if (!res.ok) throw new SourceError(`RDAP HTTP ${res.status}`, "unavailable");
    const data = (await res.json()) as RdapIpResp;
    const findings: Finding[] = [];
    if (data.name)
      findings.push(mkFinding("rdap-ip", { key: "net_name", label: "Network name", value: data.name, confidence: 0.9 }));
    if (data.handle)
      findings.push(mkFinding("rdap-ip", { key: "net_handle", label: "Network handle", value: data.handle, confidence: 0.9 }));
    if (data.country)
      findings.push(mkFinding("rdap-ip", { key: "net_country", label: "Registered country", value: data.country, confidence: 0.85 }));
    if (data.startAddress && data.endAddress)
      findings.push(
        mkFinding("rdap-ip", {
          key: "net_range",
          label: "Address range",
          value: `${data.startAddress} – ${data.endAddress}`,
          confidence: 0.9,
        })
      );
    data.cidr0_cidrs?.forEach((c) => {
      const pfx = c.v4prefix || c.v6prefix;
      if (pfx)
        findings.push(mkFinding("rdap-ip", { key: "net_cidr", label: "CIDR", value: `${pfx}/${c.length}`, confidence: 0.9 }));
    });
    const org = data.entities?.find((e) => e.roles?.includes("registrant") || e.roles?.includes("administrative"));
    if (org?.handle)
      findings.push(mkFinding("rdap-ip", { key: "net_org", label: "Organization handle", value: org.handle, confidence: 0.8 }));

    if (findings.length === 0)
      return { state: "no_results", findings: [], message: "Empty RDAP record", raw: data };
    return { state: "completed", findings, raw: data };
  },
};
