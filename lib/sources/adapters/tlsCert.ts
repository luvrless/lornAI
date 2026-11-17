import tls from "node:tls";
import type { Adapter, Finding, RunState } from "../../types";
import { targetHost, assertPublicHost, SourceError } from "../http";
import { mkFinding } from "../util";

function getCert(
  host: string,
  signal: AbortSignal
): Promise<tls.PeerCertificate> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, timeout: 10000, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate(false);
        socket.end();
        if (!cert || Object.keys(cert).length === 0)
          reject(new SourceError("no certificate", "no_results" as never));
        else resolve(cert);
      }
    );
    socket.on("error", (e) => reject(new SourceError(e.message, "unavailable")));
    socket.on("timeout", () => {
      socket.destroy();
      reject(new SourceError("tls timeout", "timeout"));
    });
    signal.addEventListener("abort", () => socket.destroy(), { once: true });
  });
}

export const tlsCertAdapter: Adapter = {
  meta: {
    id: "tls-cert",
    name: "TLS Certificate",
    category: "certificates",
    description:
      "Opens a TLS handshake to port 443 to read the presented certificate: subject, issuer, validity window and SANs.",
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
    let cert: tls.PeerCertificate;
    try {
      cert = await getCert(host, signal);
    } catch (e) {
      const kind = (e as SourceError).kind as string;
      return {
        state: (kind === "no_results" ? "no_results" : "unavailable") as RunState,
        findings: [],
        message: (e as Error).message,
      };
    }
    const findings: Finding[] = [];
    const subj = Array.isArray(cert.subject?.CN) ? cert.subject.CN.join(", ") : cert.subject?.CN;
    if (subj) findings.push(mkFinding("tls-cert", { key: "tls_subject", label: "Certificate subject", value: String(subj), confidence: 0.95 }));
    const rawIssuer = cert.issuer?.O || cert.issuer?.CN;
    const issuer = Array.isArray(rawIssuer) ? rawIssuer.join(", ") : rawIssuer;
    if (issuer) findings.push(mkFinding("tls-cert", { key: "tls_issuer", label: "Certificate issuer", value: String(issuer), confidence: 0.95 }));
    if (cert.valid_from) findings.push(mkFinding("tls-cert", { key: "tls_valid_from", label: "Valid from", value: cert.valid_from, confidence: 0.95 }));
    if (cert.valid_to) {
      const exp = new Date(cert.valid_to);
      const expired = exp.getTime() < Date.now();
      findings.push(
        mkFinding("tls-cert", {
          key: "tls_valid_to",
          label: "Valid until",
          value: `${cert.valid_to}${expired ? " (EXPIRED)" : ""}`,
          confidence: 0.95,
          categories: expired ? ["security"] : [],
        })
      );
    }
    const san = (cert as unknown as { subjectaltname?: string }).subjectaltname;
    if (san)
      san
        .split(",")
        .map((s) => s.replace(/^\s*DNS:/, "").trim())
        .slice(0, 50)
        .forEach((d) =>
          findings.push(mkFinding("tls-cert", { key: "tls_san", label: "Subject alt name", value: d, confidence: 0.85 }))
        );

    return { state: "completed", findings, raw: { subject: cert.subject, issuer: cert.issuer, valid_from: cert.valid_from, valid_to: cert.valid_to } };
  },
};
