import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// BlockCypher free Ethereum/Bitcoin address lookup (no key for read).
// https://www.blockcypher.com/dev/bitcoin/
export const ethAdapter: Adapter = {
  meta: {
    id: "eth-address",
    name: "Ethereum Address Lookup",
    category: "crypto",
    description: "Free BlockCypher API: balance, transaction count, and total sent/received for Ethereum addresses.",
    status: "integrated",
    supports: ["wallet"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://www.blockcypher.com/dev/ethereum/",
  },
  canRun: ({ normalized }) => /^0x[a-fA-F0-9]{40}$/.test(normalized),
  async run({ normalized, signal }) {
    const url = `https://api.blockcypher.com/v1/eth/main/addrs/${normalized}/balance`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 10000 });
      if (res.status === 404) return { state: "no_results", findings: [], message: "Address not found" };
      if (res.status === 429) return { state: "rate_limited", findings: [] };
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const d = await res.json() as Record<string, unknown>;
      const findings = [];
      const explorerUrl = `https://etherscan.io/address/${normalized}`;
      findings.push(mkFinding("eth-address", { key: "address", label: "ETH Address", value: normalized, sourceUrl: explorerUrl }));
      if (d.balance !== undefined) findings.push(mkFinding("eth-address", { key: "balance_wei", label: "Balance (Wei)", value: String(d.balance), sourceUrl: explorerUrl }));
      const eth = Number(d.balance) / 1e18;
      if (!isNaN(eth)) findings.push(mkFinding("eth-address", { key: "balance_eth", label: "Balance (ETH)", value: eth.toFixed(6), sourceUrl: explorerUrl }));
      if (d.total_received !== undefined) findings.push(mkFinding("eth-address", { key: "total_received", label: "Total received (Wei)", value: String(d.total_received), sourceUrl: explorerUrl }));
      if (d.total_sent !== undefined) findings.push(mkFinding("eth-address", { key: "total_sent", label: "Total sent (Wei)", value: String(d.total_sent), sourceUrl: explorerUrl }));
      if (d.n_tx !== undefined) findings.push(mkFinding("eth-address", { key: "tx_count", label: "Transaction count", value: String(d.n_tx), sourceUrl: explorerUrl }));
      findings.push(mkFinding("eth-address", { key: "etherscan", label: "View on Etherscan", value: explorerUrl, entityType: "url", sourceUrl: explorerUrl }));
      return { state: "completed", findings, raw: d };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
