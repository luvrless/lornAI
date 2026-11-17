import type { IdentifierType } from "./types";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface Detection {
  identifierType: IdentifierType;
  normalized: string;
  note?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})$/;
const DOMAIN_RE =
  /^(?=.{1,253}$)(?!-)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/;
const URL_RE = /^https?:\/\/.+/i;
const MD5_RE = /^[a-fA-F0-9]{32}$/;
const SHA1_RE = /^[a-fA-F0-9]{40}$/;
const SHA256_RE = /^[a-fA-F0-9]{64}$/;
const BTC_RE = /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/;
const ETH_RE = /^0x[a-fA-F0-9]{40}$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]{2,40}$/;

export function detectIdentifier(raw: string): Detection {
  const input = raw.trim();
  if (!input) return { identifierType: "unknown", normalized: "" };

  // URL
  if (URL_RE.test(input)) {
    try {
      const u = new URL(input);
      return { identifierType: "url", normalized: u.toString() };
    } catch {
      /* fall through */
    }
  }

  // Email
  if (EMAIL_RE.test(input)) {
    return { identifierType: "email", normalized: input.toLowerCase() };
  }

  // IP
  if (IPV4_RE.test(input)) return { identifierType: "ip", normalized: input };
  if (IPV6_RE.test(input))
    return { identifierType: "ip", normalized: input.toLowerCase() };

  // Crypto wallets
  if (ETH_RE.test(input))
    return { identifierType: "wallet", normalized: input.toLowerCase(), note: "ethereum" };
  if (BTC_RE.test(input))
    return { identifierType: "wallet", normalized: input, note: "bitcoin" };

  // Hashes
  if (SHA256_RE.test(input))
    return { identifierType: "hash", normalized: input.toLowerCase(), note: "sha256" };
  if (SHA1_RE.test(input))
    return { identifierType: "hash", normalized: input.toLowerCase(), note: "sha1" };
  if (MD5_RE.test(input))
    return { identifierType: "hash", normalized: input.toLowerCase(), note: "md5" };

  // Phone — try when it looks phone-ish
  if (/^[+()\d][\d\s().-]{5,}$/.test(input)) {
    const phone = parsePhoneNumberFromString(input, "US");
    if (phone && phone.isValid()) {
      return { identifierType: "phone", normalized: phone.number, note: phone.country };
    }
    // still treat as phone candidate if it starts with +
    if (input.startsWith("+")) {
      return { identifierType: "phone", normalized: input.replace(/[^\d+]/g, "") };
    }
  }

  // Domain (no scheme)
  if (DOMAIN_RE.test(input) && input.includes(".")) {
    return { identifierType: "domain", normalized: input.toLowerCase() };
  }

  // Username (handle)
  const handle = input.startsWith("@") ? input.slice(1) : input;
  if (USERNAME_RE.test(handle)) {
    return { identifierType: "username", normalized: handle };
  }

  // Organization fallback (contains spaces / words)
  if (/\s/.test(input) || input.length > 3) {
    return { identifierType: "organization", normalized: input };
  }

  return { identifierType: "unknown", normalized: input };
}

export function identifierLabel(t: IdentifierType): string {
  const map: Record<IdentifierType, string> = {
    email: "Email address",
    phone: "Phone number",
    username: "Username",
    domain: "Domain",
    ip: "IP address",
    url: "URL",
    hash: "File hash",
    wallet: "Crypto wallet",
    organization: "Organization",
    unknown: "Unknown",
  };
  return map[t];
}
