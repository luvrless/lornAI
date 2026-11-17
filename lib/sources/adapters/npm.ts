import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// npm registry – public, no key. Find packages by author email or username.
// https://registry.npmjs.org/-/v1/search
export const npmAdapter: Adapter = {
  meta: {
    id: "npm-registry",
    name: "npm Registry",
    category: "package_registry",
    description: "Public npm registry search: find packages authored/maintained by a username or email, with download counts and links.",
    status: "integrated",
    supports: ["username", "email"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://registry.npmjs.org/-/v1/search",
  },
  canRun: ({ identifierType }) => ["username", "email"].includes(identifierType),
  async run({ normalized, identifierType, signal }) {
    const findings = [];

    // If email, first try to find the npm username by looking up their profile
    const query = identifierType === "email"
      ? `maintainer:${normalized}`
      : `maintainer:${normalized}`;

    const searchUrl = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=10`;
    try {
      const res = await fetchWithTimeout(searchUrl, { signal, timeoutMs: 10000 });
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const data = await res.json() as { objects?: Record<string, unknown>[] };
      if (!data.objects?.length) return { state: "no_results", findings: [] };

      findings.push(mkFinding("npm-registry", { key: "pkg_count", label: "npm packages found", value: String(data.objects.length) }));

      for (const obj of data.objects.slice(0, 10)) {
        const pkg = obj["package"] as Record<string, unknown> | undefined;
        if (!pkg) continue;
        const name = String(pkg.name || "");
        const pkgUrl = `https://www.npmjs.com/package/${name}`;
        const desc = pkg.description ? ` — ${pkg.description}` : "";
        const ver = pkg.version ? ` v${pkg.version}` : "";
        findings.push(mkFinding("npm-registry", {
          key: `pkg_${name}`,
          label: "npm package",
          value: `${name}${ver}${desc}`,
          entityType: "url",
          sourceUrl: pkgUrl,
        }));
      }
      return { state: "completed", findings };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
