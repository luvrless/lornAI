import dnsp from "node:dns/promises";
import type { Adapter, Finding } from "../../types";
import { targetHost, SourceError } from "../http";
import { mkFinding, entityFinding } from "../util";

export const dnsRecordsAdapter: Adapter = {
  meta: {
    id: "dns-records",
    name: "DNS Records",
    category: "dns",
    description:
      "Resolves A, AAAA, MX, NS, TXT, CNAME and SOA records directly via public DNS.",
    status: "integrated",
    supports: ["domain", "email", "url"],
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType, normalized }) =>
    !!targetHost(identifierType, normalized),
  async run({ identifierType, normalized }) {
    const host = targetHost(identifierType, normalized);
    if (!host) throw new SourceError("no host", "failed");
    const findings: Finding[] = [];
    const raw: Record<string, unknown> = {};
    let any = false;

    const tasks: Array<Promise<void>> = [
      dnsp.resolve4(host).then((r) => {
        raw.A = r;
        r.forEach((ip) =>
          findings.push(entityFinding("dns-records", "a_record", "A record", ip, "ip", 0.95))
        );
        if (r.length) any = true;
      }).catch(() => {}),
      dnsp.resolve6(host).then((r) => {
        raw.AAAA = r;
        r.forEach((ip) =>
          findings.push(entityFinding("dns-records", "aaaa_record", "AAAA record", ip, "ip", 0.95))
        );
        if (r.length) any = true;
      }).catch(() => {}),
      dnsp.resolveMx(host).then((r) => {
        raw.MX = r;
        r.sort((a, b) => a.priority - b.priority).forEach((mx) =>
          findings.push(
            mkFinding("dns-records", {
              key: "mx_record",
              label: "MX record",
              value: `${mx.exchange} (priority ${mx.priority})`,
              confidence: 0.95,
            })
          )
        );
        if (r.length) any = true;
      }).catch(() => {}),
      dnsp.resolveNs(host).then((r) => {
        raw.NS = r;
        r.forEach((ns) =>
          findings.push(
            mkFinding("dns-records", { key: "ns_record", label: "Nameserver", value: ns, confidence: 0.95 })
          )
        );
        if (r.length) any = true;
      }).catch(() => {}),
      dnsp.resolveTxt(host).then((r) => {
        const flat = r.map((chunks) => chunks.join(""));
        raw.TXT = flat;
        flat.forEach((t) =>
          findings.push(
            mkFinding("dns-records", { key: "txt_record", label: "TXT record", value: t, confidence: 0.9 })
          )
        );
        if (flat.length) any = true;
      }).catch(() => {}),
      dnsp.resolveCname(host).then((r) => {
        raw.CNAME = r;
        r.forEach((c) =>
          findings.push(
            mkFinding("dns-records", { key: "cname_record", label: "CNAME", value: c, confidence: 0.9 })
          )
        );
      }).catch(() => {}),
      dnsp.resolveSoa(host).then((r) => {
        raw.SOA = r;
        findings.push(
          mkFinding("dns-records", {
            key: "soa_record",
            label: "SOA",
            value: `${r.nsname} / ${r.hostmaster} (serial ${r.serial})`,
            confidence: 0.9,
          })
        );
        any = true;
      }).catch(() => {}),
    ];

    await Promise.all(tasks);

    if (!any && findings.length === 0) {
      return { state: "no_results", findings: [], message: "No DNS records resolved", raw };
    }
    return { state: "completed", findings, raw };
  },
};
