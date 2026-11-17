import type { Adapter, Finding } from "../../types";
import { fetchWithTimeout, SourceError } from "../http";
import { mkFinding } from "../util";

interface BlockstreamAddr {
  address?: string;
  chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number; tx_count?: number };
  mempool_stats?: { tx_count?: number };
}

export const btcAdapter: Adapter = {
  meta: {
    id: "btc-address",
    name: "Bitcoin Address (Blockstream)",
    category: "crypto",
    description:
      "Reads public on-chain activity for a Bitcoin address: confirmed balance, total received and transaction count.",
    status: "integrated",
    supports: ["wallet"],
    docsUrl: "https://github.com/Blockstream/esplora/blob/master/API.md",
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType, normalized }) =>
    identifierType === "wallet" &&
    /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(normalized),
  async run({ normalized, signal }) {
    const res = await fetchWithTimeout(`https://blockstream.info/api/address/${normalized}`, {
      signal,
      timeoutMs: 12000,
    });
    if (res.status === 404 || res.status === 400)
      return { state: "no_results", findings: [], message: "Address not found" };
    if (res.status === 429) throw new SourceError("rate limited", "rate_limited");
    if (!res.ok) throw new SourceError(`HTTP ${res.status}`, "unavailable");
    const d = (await res.json()) as BlockstreamAddr;
    const funded = d.chain_stats?.funded_txo_sum ?? 0;
    const spent = d.chain_stats?.spent_txo_sum ?? 0;
    const balance = (funded - spent) / 1e8;
    const received = funded / 1e8;
    const txs = (d.chain_stats?.tx_count ?? 0) + (d.mempool_stats?.tx_count ?? 0);
    const findings: Finding[] = [
      mkFinding("btc-address", { key: "btc_balance", label: "Balance", value: `${balance.toFixed(8)} BTC`, confidence: 0.95 }),
      mkFinding("btc-address", { key: "btc_received", label: "Total received", value: `${received.toFixed(8)} BTC`, confidence: 0.95 }),
      mkFinding("btc-address", { key: "btc_txs", label: "Transactions", value: String(txs), confidence: 0.95, sourceUrl: `https://blockstream.info/address/${normalized}` }),
    ];
    return { state: "completed", findings, raw: d };
  },
};
