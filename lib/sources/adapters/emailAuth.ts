import dnsp from "node:dns/promises";
import type { Adapter, Finding } from "../../types";
import { targetHost, SourceError } from "../http";
import { mkFinding } from "../util";

// Identify mail provider from MX hostnames
function provider(mx: string[]): string | null {
  const j = mx.join(" ").toLowerCase();
  if (/google|googlemail|aspmx\.l\.google/.test(j)) return "Google Workspace";
  if (/outlook|protection\.outlook|office365|microsoft/.test(j)) return "Microsoft 365";
  if (/zoho/.test(j)) return "Zoho Mail";
  if (/protonmail|proton\.me/.test(j)) return "Proton Mail";
  if (/yahoodns|yahoo/.test(j)) return "Yahoo";
  if (/icloud|apple/.test(j)) return "Apple iCloud";
  if (/mailgun/.test(j)) return "Mailgun";
  if (/sendgrid/.test(j)) return "SendGrid";
  if (/amazonaws|amazonses/.test(j)) return "Amazon SES";
  if (/pphosted|proofpoint/.test(j)) return "Proofpoint";
  if (/mimecast/.test(j)) return "Mimecast";
  if (/secureserver|godaddy/.test(j)) return "GoDaddy";
  return null;
}

export const emailAuthAdapter: Adapter = {
  meta: {
    id: "email-auth",
    name: "Email Security (SPF / DMARC / Provider)",
    category: "email",
    description:
      "Reads SPF and DMARC policy from DNS and infers the mail provider from MX records to assess email security posture.",
    status: "integrated",
    supports: ["domain", "email"],
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType, normalized }) =>
    (identifierType === "email" || identifierType === "domain") &&
    !!targetHost(identifierType, normalized),
  async run({ identifierType, normalized }) {
    const host = targetHost(identifierType, normalized);
    if (!host) throw new SourceError("no host", "failed");
    const findings: Finding[] = [];
    const raw: Record<string, unknown> = {};

    // MX + provider
    try {
      const mx = await dnsp.resolveMx(host);
      const names = mx.map((m) => m.exchange);
      raw.mx = names;
      const p = provider(names);
      if (p)
        findings.push(
          mkFinding("email-auth", { key: "mail_provider", label: "Mail provider", value: p, confidence: 0.85 })
        );
      findings.push(
        mkFinding("email-auth", {
          key: "accepts_mail",
          label: "Accepts mail",
          value: names.length ? "yes (MX present)" : "no MX",
          confidence: 0.9,
        })
      );
    } catch {
      /* ignore */
    }

    // SPF + DMARC from TXT
    try {
      const txt = (await dnsp.resolveTxt(host)).map((c) => c.join(""));
      const spf = txt.find((t) => /^v=spf1/i.test(t));
      raw.spf = spf || null;
      findings.push(
        spf
          ? mkFinding("email-auth", { key: "spf", label: "SPF policy", value: spf, confidence: 0.95 })
          : mkFinding("email-auth", { key: "spf_missing", label: "SPF policy", value: "not published (spoofing risk)", confidence: 0.8, categories: ["security"] })
      );
    } catch {
      /* ignore */
    }

    try {
      const dmarcTxt = (await dnsp.resolveTxt(`_dmarc.${host}`)).map((c) => c.join(""));
      const dmarc = dmarcTxt.find((t) => /v=DMARC1/i.test(t));
      raw.dmarc = dmarc || null;
      if (dmarc) {
        const policy = /p=([a-z]+)/i.exec(dmarc)?.[1] || "unknown";
        findings.push(
          mkFinding("email-auth", {
            key: "dmarc",
            label: "DMARC policy",
            value: `${dmarc} (enforcement: ${policy})`,
            confidence: 0.95,
          })
        );
      } else {
        findings.push(
          mkFinding("email-auth", { key: "dmarc_missing", label: "DMARC policy", value: "not published", confidence: 0.8, categories: ["security"] })
        );
      }
    } catch {
      findings.push(
        mkFinding("email-auth", { key: "dmarc_missing", label: "DMARC policy", value: "not published", confidence: 0.7, categories: ["security"] })
      );
    }

    if (findings.length === 0)
      return { state: "no_results", findings: [], message: "No mail config found", raw };
    return { state: "completed", findings, raw };
  },
};
