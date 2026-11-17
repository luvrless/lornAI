import dns from "node:dns/promises";
import net from "node:net";
import type { IdentifierType } from "../types";

export const UA =
  "lorn.lol-osint/0.1 (+https://lorn.lol; defensive-research)";

export class SourceError extends Error {
  constructor(
    message: string,
    public kind:
      | "timeout"
      | "rate_limited"
      | "auth_required"
      | "unavailable"
      | "failed" = "failed"
  ) {
    super(message);
  }
}

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<Response> {
  const { timeoutMs = 12000, signal, ...rest } = opts;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) ac.abort();
    else signal.addEventListener("abort", () => ac.abort(), { once: true });
  }
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ac.signal,
      headers: { "user-agent": UA, accept: "application/json", ...(rest.headers || {}) },
    });
    return res;
  } catch (e: unknown) {
    if (ac.signal.aborted) throw new SourceError("request timed out", "timeout");
    throw new SourceError((e as Error)?.message || "network error", "failed");
  } finally {
    clearTimeout(timer);
  }
}

// ---- SSRF protection for user-controlled hosts ----

function ipIsPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    if (p[0] >= 224) return true; // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1") return true;
    if (low.startsWith("fe80")) return true; // link local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA
    if (low === "::") return true;
    return false;
  }
  return true; // unknown → treat as unsafe
}

// Resolve host and ensure it is public before fetching (blocks SSRF to internal infra)
export async function assertPublicHost(host: string): Promise<void> {
  if (net.isIP(host)) {
    if (ipIsPrivate(host)) throw new SourceError("blocked private address", "failed");
    return;
  }
  let addrs: string[] = [];
  try {
    const r = await dns.lookup(host, { all: true });
    addrs = r.map((a) => a.address);
  } catch {
    throw new SourceError("host did not resolve", "unavailable");
  }
  if (addrs.length === 0) throw new SourceError("host did not resolve", "unavailable");
  for (const a of addrs) {
    if (ipIsPrivate(a)) throw new SourceError("blocked private address", "failed");
  }
}

// Derive the DNS host for domain-oriented adapters from any identifier
export function targetHost(
  identifierType: IdentifierType,
  normalized: string
): string | null {
  switch (identifierType) {
    case "domain":
      return normalized;
    case "email": {
      const at = normalized.lastIndexOf("@");
      return at === -1 ? null : normalized.slice(at + 1);
    }
    case "url": {
      try {
        return new URL(normalized).hostname;
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}
