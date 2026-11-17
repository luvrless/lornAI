import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// GitHub public REST API – user/org, repo, commit search (keyless 10 req/min)
// https://docs.github.com/rest
export const githubAdapter: Adapter = {
  meta: {
    id: "github-public",
    name: "GitHub Public",
    category: "developer",
    description: "Public GitHub API: user profile, repos, gists, commit email search, org membership — no key (60 req/h).",
    status: "integrated",
    supports: ["username", "email"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://docs.github.com/rest",
  },
  canRun: ({ identifierType }) => ["username", "email"].includes(identifierType),
  async run({ normalized, identifierType, signal }) {
    const findings = [];
    const baseApi = "https://api.github.com";
    const headers = { accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };

    if (identifierType === "username") {
      try {
        const res = await fetchWithTimeout(`${baseApi}/users/${encodeURIComponent(normalized)}`, { signal, timeoutMs: 10000, headers });
        if (res.ok) {
          const d = await res.json() as Record<string, unknown>;
          const profileUrl = `https://github.com/${normalized}`;
          if (d.name) findings.push(mkFinding("github-public", { key: "name", label: "Display name", value: String(d.name), sourceUrl: profileUrl }));
          if (d.bio) findings.push(mkFinding("github-public", { key: "bio", label: "Bio", value: String(d.bio), sourceUrl: profileUrl }));
          if (d.company) findings.push(mkFinding("github-public", { key: "company", label: "Company", value: String(d.company), sourceUrl: profileUrl }));
          if (d.location) findings.push(mkFinding("github-public", { key: "location", label: "Location", value: String(d.location), sourceUrl: profileUrl }));
          if (d.blog) findings.push(mkFinding("github-public", { key: "blog", label: "Website/blog", value: String(d.blog), entityType: "url", sourceUrl: String(d.blog) }));
          if (d.email) findings.push(mkFinding("github-public", { key: "email", label: "Public email", value: String(d.email), entityType: "email", sourceUrl: profileUrl }));
          if (d.twitter_username) findings.push(mkFinding("github-public", { key: "twitter", label: "Twitter/X", value: `@${d.twitter_username}`, entityType: "username" }));
          if (d.public_repos !== undefined) findings.push(mkFinding("github-public", { key: "repos", label: "Public repos", value: String(d.public_repos), sourceUrl: profileUrl }));
          if (d.followers !== undefined) findings.push(mkFinding("github-public", { key: "followers", label: "Followers", value: String(d.followers), sourceUrl: profileUrl }));
          if (d.created_at) findings.push(mkFinding("github-public", { key: "created_at", label: "Account created", value: String(d.created_at), sourceUrl: profileUrl }));
          findings.push(mkFinding("github-public", { key: "profile", label: "GitHub profile", value: profileUrl, entityType: "url", sourceUrl: profileUrl }));

          // Top repos
          const rRes = await fetchWithTimeout(`${baseApi}/users/${encodeURIComponent(normalized)}/repos?per_page=5&sort=updated`, { signal, timeoutMs: 8000, headers });
          if (rRes.ok) {
            const repos = await rRes.json() as Record<string, unknown>[];
            for (const repo of repos.slice(0, 5)) {
              findings.push(mkFinding("github-public", {
                key: `repo_${repo.name}`,
                label: "Repository",
                value: `${repo.full_name} ⭐${repo.stargazers_count}${repo.language ? ` [${repo.language}]` : ""}`,
                entityType: "url",
                sourceUrl: String(repo.html_url || ""),
              }));
            }
          }
        }
      } catch { /* ignore */ }
    }

    if (identifierType === "email") {
      // Commit search for email mentions in public commits
      try {
        const res = await fetchWithTimeout(
          `${baseApi}/search/commits?q=${encodeURIComponent(`author-email:${normalized}`)}&per_page=5`,
          { signal, timeoutMs: 12000, headers: { ...headers, accept: "application/vnd.github.cloak-preview+json" } }
        );
        if (res.ok) {
          const d = await res.json() as { total_count?: number; items?: Record<string, unknown>[] };
          if (d.total_count) findings.push(mkFinding("github-public", { key: "commit_count", label: "Commits with this email", value: String(d.total_count) }));
          for (const item of (d.items || []).slice(0, 5)) {
            const c = item["commit"] as Record<string, unknown> | undefined;
            const a = c?.["author"] as Record<string, unknown> | undefined;
            const repo = (item["repository"] as Record<string, unknown> | undefined)?.["full_name"];
            if (a?.name) findings.push(mkFinding("github-public", { key: `committer_${findings.length}`, label: "Committer name", value: String(a.name), entityType: "username" }));
            if (repo) findings.push(mkFinding("github-public", { key: `commit_repo_${findings.length}`, label: "Commit in repo", value: String(repo), entityType: "url", sourceUrl: `https://github.com/${repo}` }));
          }
        }
      } catch { /* ignore */ }

      // User search
      try {
        const res = await fetchWithTimeout(
          `${baseApi}/search/users?q=${encodeURIComponent(normalized)}+in:email&per_page=3`,
          { signal, timeoutMs: 10000, headers }
        );
        if (res.ok) {
          const d = await res.json() as { items?: Record<string, unknown>[] };
          for (const u of (d.items || []).slice(0, 3)) {
            if (u.login) findings.push(mkFinding("github-public", { key: `user_${u.login}`, label: "GitHub user (email match)", value: String(u.login), entityType: "username", sourceUrl: `https://github.com/${u.login}` }));
          }
        }
      } catch { /* ignore */ }
    }

    return { state: findings.length ? "completed" : "no_results", findings };
  },
};
