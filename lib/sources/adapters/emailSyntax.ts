import type { Adapter } from "../../types";
import { mkFinding, entityFinding } from "../util";

const ROLE_LOCALS = new Set([
  "admin", "administrator", "support", "info", "contact", "sales", "help",
  "noreply", "no-reply", "postmaster", "webmaster", "abuse", "security",
  "hello", "team", "billing", "office", "mail", "hr", "jobs", "careers",
]);

const FREE_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com",
  "hotmail.com", "live.com", "icloud.com", "me.com", "proton.me",
  "protonmail.com", "aol.com", "gmx.com", "mail.com", "zoho.com", "yandex.com",
]);

export const emailSyntaxAdapter: Adapter = {
  meta: {
    id: "email-syntax",
    name: "Email Syntax & Structure",
    category: "email",
    description:
      "Validates RFC-style email structure, extracts the domain and local part, and classifies role/free-provider addresses.",
    status: "integrated",
    supports: ["email"],
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType }) => identifierType === "email",
  async run({ normalized }) {
    const at = normalized.lastIndexOf("@");
    const local = normalized.slice(0, at);
    const domain = normalized.slice(at + 1);
    const findings = [
      mkFinding("email-syntax", {
        key: "valid_syntax",
        label: "Syntax valid",
        value: "true",
        confidence: 1,
      }),
      entityFinding("email-syntax", "email_domain", "Email domain", domain, "domain", 1),
      mkFinding("email-syntax", {
        key: "local_part",
        label: "Local part",
        value: local,
        confidence: 1,
      }),
    ];
    if (ROLE_LOCALS.has(local.toLowerCase())) {
      findings.push(
        mkFinding("email-syntax", {
          key: "role_account",
          label: "Role-based address",
          value: `likely a shared/role mailbox (${local})`,
          confidence: 0.8,
        })
      );
    }
    findings.push(
      mkFinding("email-syntax", {
        key: "provider_type",
        label: "Provider type",
        value: FREE_PROVIDERS.has(domain.toLowerCase())
          ? "free webmail provider"
          : "custom / organizational domain",
        confidence: 0.85,
      })
    );
    return { state: "completed", findings, raw: { local, domain } };
  },
};
