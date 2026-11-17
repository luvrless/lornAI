import dnsp from "node:dns/promises";
import type { Adapter, Finding } from "../../types";
import { entityFinding } from "../util";

export const reverseDnsAdapter: Adapter = {
  meta: {
    id: "reverse-dns",
    name: "Reverse DNS (PTR)",
    category: "dns",
    description: "Resolves the PTR record(s) for an IP address to reveal associated hostnames.",
    status: "integrated",
    supports: ["ip"],
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType }) => identifierType === "ip",
  async run({ normalized }) {
    try {
      const names = await dnsp.reverse(normalized);
      if (!names.length)
        return { state: "no_results", findings: [], message: "No PTR record" };
      const findings: Finding[] = names.map((n) =>
        entityFinding("reverse-dns", "ptr", "PTR hostname", n.toLowerCase(), "domain", 0.85)
      );
      return { state: "completed", findings, raw: names };
    } catch {
      return { state: "no_results", findings: [], message: "No PTR record" };
    }
  },
};
