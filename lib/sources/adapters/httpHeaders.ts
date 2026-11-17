import type { Adapter, Finding } from "../../types";
import { targetHost, fetchWithTimeout, assertPublicHost, SourceError } from "../http";
import { mkFinding } from "../util";

// Lightweight technology fingerprint from headers / HTML hints
function fingerprint(headers: Headers, html: string): string[] {
  const tech = new Set<string>();
  const server = headers.get("server");
  if (server) tech.add(server);
  const powered = headers.get("x-powered-by");
  if (powered) tech.add(powered);
  if (headers.get("x-vercel-id")) tech.add("Vercel");
  if (headers.get("cf-ray")) tech.add("Cloudflare");
  if (headers.get("x-amz-cf-id")) tech.add("Amazon CloudFront");
  if (headers.get("x-shopify-stage")) tech.add("Shopify");
  if (/wp-content|wp-includes/.test(html)) tech.add("WordPress");
  if (/__NEXT_DATA__/.test(html)) tech.add("Next.js");
  if (/data-reactroot|react/.test(html)) tech.add("React");
  if (/ng-version/.test(html)) tech.add("Angular");
  if (/Drupal/.test(html)) tech.add("Drupal");
  return [...tech];
}

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

export const httpHeadersAdapter: Adapter = {
  meta: {
    id: "http-headers",
    name: "HTTP Headers & Tech Fingerprint",
    category: "tech_fingerprint",
    description:
      "Non-invasively fetches the site root to inspect HTTP status, server headers, security headers, redirect target and detectable technologies.",
    status: "integrated",
    supports: ["domain", "url"],
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType, normalized }) =>
    (identifierType === "domain" || identifierType === "url") &&
    !!targetHost(identifierType, normalized),
  async run({ identifierType, normalized, signal }) {
    const host = targetHost(identifierType, normalized);
    if (!host) throw new SourceError("no host", "failed");
    await assertPublicHost(host);
    const url = identifierType === "url" ? normalized : `https://${host}/`;
    const res = await fetchWithTimeout(url, {
      signal,
      timeoutMs: 12000,
      redirect: "manual",
      headers: { accept: "text/html,*/*" },
    });

    const findings: Finding[] = [];
    findings.push(
      mkFinding("http-headers", { key: "http_status", label: "HTTP status", value: String(res.status), confidence: 1 })
    );
    const loc = res.headers.get("location");
    if (loc)
      findings.push(mkFinding("http-headers", { key: "redirect", label: "Redirects to", value: loc, confidence: 0.95 }));

    let html = "";
    if (res.status < 300 || res.status >= 400) {
      try {
        html = (await res.text()).slice(0, 60000);
      } catch {
        /* ignore body */
      }
    }

    const present = SECURITY_HEADERS.filter((h) => res.headers.get(h));
    const missing = SECURITY_HEADERS.filter((h) => !res.headers.get(h));
    findings.push(
      mkFinding("http-headers", {
        key: "security_headers",
        label: "Security headers present",
        value: present.length ? present.join(", ") : "none",
        confidence: 0.9,
        categories: ["security"],
      })
    );
    if (missing.length)
      findings.push(
        mkFinding("http-headers", {
          key: "security_headers_missing",
          label: "Security headers missing",
          value: missing.join(", "),
          confidence: 0.85,
          categories: ["security"],
        })
      );

    fingerprint(res.headers, html).forEach((t) =>
      findings.push(mkFinding("http-headers", { key: "technology", label: "Technology", value: t, confidence: 0.75 }))
    );

    const title = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)?.[1]?.trim();
    if (title)
      findings.push(mkFinding("http-headers", { key: "page_title", label: "Page title", value: title, confidence: 0.9 }));

    return {
      state: "completed",
      findings,
      raw: { status: res.status, headers: Object.fromEntries(res.headers.entries()) },
    };
  },
};
