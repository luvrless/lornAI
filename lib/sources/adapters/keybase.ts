import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// Keybase public API – cryptographic identity proofs, no key needed.
// https://keybase.io/docs/api/1.0
export const keybaseAdapter: Adapter = {
  meta: {
    id: "keybase",
    name: "Keybase",
    category: "developer",
    description: "Keybase public identity: cryptographic proofs linking username to GitHub, Twitter, Reddit, Mastodon, Bitcoin, Stellar, and more.",
    status: "integrated",
    supports: ["username"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://keybase.io/docs/api/1.0",
  },
  canRun: ({ identifierType }) => identifierType === "username",
  async run({ normalized, signal }) {
    const url = `https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(normalized)}`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 10000 });
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const data = await res.json() as { status?: { name?: string }; them?: Record<string, unknown>[] };
      if (data.status?.name !== "OK" || !data.them?.length) return { state: "no_results", findings: [], message: "No Keybase user" };
      const u = data.them[0];
      const profileUrl = `https://keybase.io/${normalized}`;
      const findings = [];

      const basic = u["basics"] as Record<string, unknown> | undefined;
      const profile = u["profile"] as Record<string, unknown> | undefined;
      const proofsList = (u["proofs_summary"] as Record<string, unknown> | undefined)?.["all"] as Record<string, unknown>[] | undefined;

      if (basic?.username) findings.push(mkFinding("keybase", { key: "username", label: "Keybase username", value: String(basic.username), entityType: "username", sourceUrl: profileUrl }));
      if (profile?.full_name) findings.push(mkFinding("keybase", { key: "name", label: "Full name", value: String(profile.full_name), sourceUrl: profileUrl }));
      if (profile?.bio) findings.push(mkFinding("keybase", { key: "bio", label: "Bio", value: String(profile.bio), sourceUrl: profileUrl }));
      if (profile?.location) findings.push(mkFinding("keybase", { key: "location", label: "Location", value: String(profile.location), sourceUrl: profileUrl }));
      findings.push(mkFinding("keybase", { key: "profile", label: "Keybase profile", value: profileUrl, entityType: "url", sourceUrl: profileUrl }));

      if (proofsList) {
        for (const proof of proofsList) {
          const nametag = proof["nametag"] as string | undefined;
          const proofType = proof["proof_type"] as string | undefined;
          const proofUrl = proof["service_url"] as string | undefined;
          if (nametag && proofType) {
            findings.push(mkFinding("keybase", {
              key: `proof_${proofType}`,
              label: `Identity proof: ${proofType}`,
              value: nametag,
              entityType: proofUrl ? "url" : "username",
              sourceUrl: proofUrl,
              confidence: 0.95,
              extra: { verified: true },
            }));
          }
        }
      }

      return { state: "completed", findings, raw: u };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
