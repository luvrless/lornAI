import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// crates.io – Rust package registry, public API, no key.
export const cratesAdapter: Adapter = {
  meta: {
    id: "crates-io",
    name: "crates.io (Rust)",
    category: "package_registry",
    description: "Public crates.io API: find Rust crates owned or maintained by a username.",
    status: "integrated",
    supports: ["username"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://crates.io/data-access",
  },
  canRun: ({ identifierType }) => identifierType === "username",
  async run({ normalized, signal }) {
    const url = `https://crates.io/api/v1/crates?user_id=0&q=${encodeURIComponent(normalized)}&per_page=5`;
    // Look up user first
    try {
      const uRes = await fetchWithTimeout(
        `https://crates.io/api/v1/users/${encodeURIComponent(normalized)}`,
        { signal, timeoutMs: 8000, headers: { "user-agent": "lorn-osint/1.0" } }
      );
      if (!uRes.ok) return { state: "no_results", findings: [] };
      const uData = await uRes.json() as { user?: Record<string, unknown> };
      const user = uData.user;
      if (!user) return { state: "no_results", findings: [] };
      const findings = [];
      const profileUrl = `https://crates.io/users/${normalized}`;
      if (user.name) findings.push(mkFinding("crates-io", { key: "name", label: "Name", value: String(user.name), sourceUrl: profileUrl }));
      if (user.login) findings.push(mkFinding("crates-io", { key: "login", label: "Login", value: String(user.login), entityType: "username", sourceUrl: profileUrl }));
      if (user.url) findings.push(mkFinding("crates-io", { key: "github", label: "GitHub URL", value: String(user.url), entityType: "url", sourceUrl: String(user.url) }));
      findings.push(mkFinding("crates-io", { key: "profile", label: "crates.io profile", value: profileUrl, entityType: "url", sourceUrl: profileUrl }));

      const uid = user.id;
      if (uid) {
        try {
          const cRes = await fetchWithTimeout(
            `https://crates.io/api/v1/crates?user_id=${uid}&per_page=5`,
            { signal, timeoutMs: 8000, headers: { "user-agent": "lorn-osint/1.0" } }
          );
          if (cRes.ok) {
            const cData = await cRes.json() as { crates?: Record<string, unknown>[]; meta?: Record<string, unknown> };
            if (cData.meta?.total !== undefined) findings.push(mkFinding("crates-io", { key: "crate_count", label: "Published crates", value: String(cData.meta.total) }));
            for (const c of (cData.crates || []).slice(0, 5)) {
              findings.push(mkFinding("crates-io", {
                key: `crate_${c.name}`,
                label: "Rust crate",
                value: `${c.name} v${c.newest_version} — ${String(c.description || "").slice(0, 80)}`,
                entityType: "url",
                sourceUrl: `https://crates.io/crates/${c.name}`,
              }));
            }
          }
        } catch { /* ignore */ }
      }

      return { state: "completed", findings };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
