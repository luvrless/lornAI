import dnsp from "node:dns/promises";
import net from "node:net";
import type { Adapter, Finding } from "../../types";
import { mkFinding } from "../util";

// Public DNS blocklists that answer A records for listed IPs.
const BLOCKLISTS = [
  { zone: "zen.spamhaus.org", name: "Spamhaus ZEN" },
  { zone: "bl.spamcop.net", name: "SpamCop" },
  { zone: "b.barracudacentral.org", name: "Barracuda" },
  { zone: "dnsbl.sorbs.net", name: "SORBS" },
  { zone: "all.s5h.net", name: "s5h.net" },
];

function reverseV4(ip: string): string {
  return ip.split(".").reverse().join(".");
}

export const dnsblAdapter: Adapter = {
  meta: {
    id: "ip-dnsbl",
    name: "IP Reputation (DNSBL)",
    category: "domain_reputation",
    description:
      "Checks an IPv4 address against several public DNS blocklists used to flag spam/abuse sources.",
    status: "integrated",
    supports: ["ip"],
    authRequired: false,
    privacy: "defensive",
  },
  canRun: ({ identifierType, normalized }) =>
    identifierType === "ip" && net.isIPv4(normalized),
  async run({ normalized }) {
    const rev = reverseV4(normalized);
    const findings: Finding[] = [];
    let listed = 0;
    await Promise.all(
      BLOCKLISTS.map(async (bl) => {
        try {
          const a = await dnsp.resolve4(`${rev}.${bl.zone}`);
          if (a.length) {
            listed++;
            findings.push(
              mkFinding("ip-dnsbl", {
                key: "dnsbl_listed",
                label: `Listed: ${bl.name}`,
                value: `flagged (${a.join(", ")})`,
                confidence: 0.85,
                categories: ["reputation", "security"],
              })
            );
          }
        } catch {
          // NXDOMAIN ⇒ not listed (normal)
        }
      })
    );
    findings.unshift(
      mkFinding("ip-dnsbl", {
        key: "dnsbl_summary",
        label: "Blocklist status",
        value: listed ? `listed on ${listed}/${BLOCKLISTS.length} blocklists` : `clean (0/${BLOCKLISTS.length})`,
        confidence: 0.8,
        categories: ["reputation"],
      })
    );
    return { state: "completed", findings, raw: { listed, checked: BLOCKLISTS.length } };
  },
};
