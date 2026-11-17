import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// GitLab public user API – no key needed.
// https://docs.gitlab.com/ee/api/users.html
export const gitlabAdapter: Adapter = {
  meta: {
    id: "gitlab-public",
    name: "GitLab Public API",
    category: "developer",
    description: "Public GitLab user/org metadata: name, bio, repos, joined date, followers — no API key required.",
    status: "integrated",
    supports: ["username"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://docs.gitlab.com/ee/api/users.html",
  },
  canRun: ({ identifierType }) => identifierType === "username",
  async run({ normalized, signal }) {
    const url = `https://gitlab.com/api/v4/users?username=${encodeURIComponent(normalized)}`;
    try {
      const res = await fetchWithTimeout(url, { signal, timeoutMs: 10000 });
      if (!res.ok) return { state: "failed", findings: [], message: `HTTP ${res.status}` };
      const data = await res.json() as Record<string, unknown>[];
      if (!data.length) return { state: "no_results", findings: [], message: "No GitLab user found" };
      const u = data[0];
      const profileUrl = String(u["web_url"] || `https://gitlab.com/${normalized}`);
      const findings = [];
      if (u.name) findings.push(mkFinding("gitlab-public", { key: "name", label: "Display name", value: String(u.name), sourceUrl: profileUrl }));
      if (u.bio) findings.push(mkFinding("gitlab-public", { key: "bio", label: "Bio", value: String(u.bio), sourceUrl: profileUrl }));
      if (u.location) findings.push(mkFinding("gitlab-public", { key: "location", label: "Location", value: String(u.location), sourceUrl: profileUrl }));
      if (u.website_url) findings.push(mkFinding("gitlab-public", { key: "website", label: "Website", value: String(u.website_url), entityType: "url", sourceUrl: String(u.website_url) }));
      if (u.twitter) findings.push(mkFinding("gitlab-public", { key: "twitter", label: "Twitter/X", value: String(u.twitter), entityType: "username" }));
      if (u.created_at) findings.push(mkFinding("gitlab-public", { key: "joined", label: "Joined", value: String(u.created_at), sourceUrl: profileUrl }));
      if (u.followers !== undefined) findings.push(mkFinding("gitlab-public", { key: "followers", label: "Followers", value: String(u.followers), sourceUrl: profileUrl }));
      findings.push(mkFinding("gitlab-public", { key: "profile", label: "GitLab profile", value: profileUrl, entityType: "url", sourceUrl: profileUrl }));
      if (u.avatar_url) findings.push(mkFinding("gitlab-public", { key: "avatar", label: "Avatar URL", value: String(u.avatar_url), entityType: "url" }));

      // Repos
      const userId = u["id"];
      if (userId) {
        try {
          const rRes = await fetchWithTimeout(
            `https://gitlab.com/api/v4/users/${userId}/projects?per_page=5&order_by=last_activity_at`,
            { signal, timeoutMs: 8000 }
          );
          if (rRes.ok) {
            const repos = await rRes.json() as Record<string, unknown>[];
            for (const r of repos.slice(0, 5)) {
              findings.push(mkFinding("gitlab-public", {
                key: `repo_${r.id}`,
                label: "Repository",
                value: `${r.path_with_namespace} ⭐${r.star_count || 0}`,
                entityType: "url",
                sourceUrl: String(r.web_url || ""),
              }));
            }
          }
        } catch { /* ignore */ }
      }

      return { state: "completed", findings, raw: u };
    } catch (e) {
      return { state: "failed", findings: [], message: (e as Error).message };
    }
  },
};
