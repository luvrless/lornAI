import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";
import * as crypto from "node:crypto";

// Gravatar public profile lookup by email MD5 hash — no API key needed.
// https://docs.gravatar.com/
export const gravatarAdapter: Adapter = {
  meta: {
    id: "gravatar",
    name: "Gravatar Profile",
    category: "social",
    description: "Looks up a Gravatar profile by email (via MD5 hash). Returns display name, bio, linked accounts, and profile URLs.",
    status: "integrated",
    supports: ["email"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://docs.gravatar.com/",
  },
  canRun: ({ identifierType }) => identifierType === "email",
  async run({ normalized, signal }) {
    const hash = crypto.createHash("md5").update(normalized.toLowerCase().trim()).digest("hex");
    const url = `https://www.gravatar.com/${hash}.json`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 8000 });
      if (res.status === 404) return { state: "no_results", findings: [], message: "No Gravatar profile" };
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const data = await res.json() as { entry?: Record<string, unknown>[] };
      const entry = data?.entry?.[0];
      if (!entry) return { state: "no_results", findings: [] };

      const findings = [];
      const profileUrl = `https://gravatar.com/${hash}`;

      const g = (k: string): string => {
        const v = (entry as Record<string, unknown>)[k];
        return v !== null && v !== undefined ? String(v) : "";
      };

      if (g("displayName")) findings.push(mkFinding("gravatar", { key: "display_name", label: "Display name", value: g("displayName"), sourceUrl: profileUrl }));
      if (g("preferredUsername")) findings.push(mkFinding("gravatar", { key: "username", label: "Preferred username", value: g("preferredUsername"), sourceUrl: profileUrl }));
      findings.push(mkFinding("gravatar", { key: "profile_url", label: "Gravatar profile", value: profileUrl, entityType: "url", sourceUrl: profileUrl }));
      findings.push(mkFinding("gravatar", { key: "avatar", label: "Avatar URL", value: `https://www.gravatar.com/avatar/${hash}`, entityType: "url" }));

      const about = entry["aboutMe"];
      if (about) findings.push(mkFinding("gravatar", { key: "bio", label: "About", value: String(about) }));

      const loc = (entry as Record<string, unknown>)["currentLocation"];
      if (loc) findings.push(mkFinding("gravatar", { key: "location", label: "Location", value: String(loc) }));

      const urls = (entry as Record<string, unknown>)["urls"];
      if (Array.isArray(urls)) {
        for (const u of urls as Array<{ value: string; title?: string }>) {
          if (u.value) findings.push(mkFinding("gravatar", { key: `linked_url_${findings.length}`, label: `Linked URL${u.title ? ` (${u.title})` : ""}`, value: u.value, entityType: "url", sourceUrl: u.value }));
        }
      }

      const accounts = (entry as Record<string, unknown>)["accounts"];
      if (Array.isArray(accounts)) {
        for (const a of accounts as Array<{ shortname?: string; display?: string; url?: string; verified?: boolean }>) {
          if (a.shortname) findings.push(mkFinding("gravatar", {
            key: `account_${a.shortname}`,
            label: `Linked account: ${a.display || a.shortname}`,
            value: a.url || a.shortname,
            entityType: a.url ? "url" : "username",
            sourceUrl: a.url,
            extra: { verified: a.verified },
          }));
        }
      }

      return { state: "completed", findings, raw: entry };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
