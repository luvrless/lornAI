import type { Adapter } from "../../types";
import { targetHost } from "../http";
import { mkFinding } from "../util";

// Curated static list of well-known disposable / temporary email domains.
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org",
  "tempmail.com", "throwawaymail.com", "yopmail.com", "getnada.com",
  "dispostable.com", "trashmail.com", "fakeinbox.com", "maildrop.cc",
  "sharklasers.com", "guerrillamailblock.com", "mailnesia.com", "mohmal.com",
  "tempinbox.com", "emailondeck.com", "33mail.com", "mintemail.com",
  "spamgourmet.com", "mailcatch.com", "tempr.email", "burnermail.io",
  "moakt.com", "temp-mail.io", "luxusmail.org", "1secmail.com", "tmpmail.org",
  "inboxbear.com", "mailpoof.com", "emailfake.com", "harakirimail.com",
]);

export const disposableAdapter: Adapter = {
  meta: {
    id: "disposable-email",
    name: "Disposable Email Detection",
    category: "email",
    description:
      "Checks the email domain against a curated list of known disposable / temporary mail providers.",
    status: "integrated",
    supports: ["email", "domain"],
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType }) =>
    identifierType === "email" || identifierType === "domain",
  async run({ identifierType, normalized }) {
    const host = targetHost(identifierType, normalized) || normalized;
    const disposable = DISPOSABLE.has(host.toLowerCase());
    return {
      state: "completed",
      findings: [
        mkFinding("disposable-email", {
          key: "disposable",
          label: "Disposable provider",
          value: disposable ? "yes — known temporary mail provider" : "not on known list",
          confidence: disposable ? 0.95 : 0.6,
        }),
      ],
      raw: { host, disposable },
    };
  },
};
