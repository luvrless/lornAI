import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// Hacker News Algolia search API – completely public, no key.
// https://hn.algolia.com/api
export const hnAdapter: Adapter = {
  meta: {
    id: "hackernews-search",
    name: "Hacker News Search",
    category: "forum",
    description: "Full-text Hacker News search via Algolia API: comments, stories, and profiles mentioning an email, username, or domain.",
    status: "integrated",
    supports: ["username", "email", "domain"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://hn.algolia.com/api",
  },
  canRun: ({ identifierType }) => ["username", "email", "domain"].includes(identifierType),
  async run({ normalized, identifierType, signal }) {
    const findings = [];

    if (identifierType === "username") {
      // Direct profile lookup via HN Firebase API
      try {
        const pRes = await fetchWithTimeout(
          `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(normalized)}.json`,
          { signal, timeoutMs: 8000 }
        );
        if (pRes.ok) {
          const u = await pRes.json() as Record<string, unknown> | null;
          if (u?.id) {
            const profileUrl = `https://news.ycombinator.com/user?id=${normalized}`;
            findings.push(mkFinding("hackernews-search", { key: "profile", label: "HN profile", value: profileUrl, entityType: "url", sourceUrl: profileUrl }));
            if (u.karma !== undefined) findings.push(mkFinding("hackernews-search", { key: "karma", label: "Karma", value: String(u.karma), sourceUrl: profileUrl }));
            if (u.created !== undefined) findings.push(mkFinding("hackernews-search", { key: "created", label: "Account created", value: new Date(Number(u.created) * 1000).toISOString(), sourceUrl: profileUrl }));
            if (u.about) findings.push(mkFinding("hackernews-search", { key: "about", label: "About", value: String(u.about).replace(/<[^>]+>/g, " ").trim().slice(0, 300), sourceUrl: profileUrl }));
          }
        }
      } catch { /* ignore */ }
    }

    // Full-text search
    const q = identifierType === "email" ? `"${normalized}"` : normalized;
    try {
      const sRes = await fetchWithTimeout(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&hitsPerPage=5`,
        { signal, timeoutMs: 10000 }
      );
      if (sRes.ok) {
        const data = await sRes.json() as { nbHits?: number; hits?: Record<string, unknown>[] };
        if (data.nbHits) findings.push(mkFinding("hackernews-search", { key: "total_hits", label: "HN mentions", value: String(data.nbHits) }));
        for (const hit of (data.hits || []).slice(0, 5)) {
          const storyUrl = hit.url ? String(hit.url) : `https://news.ycombinator.com/item?id=${hit.objectID}`;
          const title = String(hit.title || hit.story_title || hit.comment_text || "").slice(0, 120);
          if (title) findings.push(mkFinding("hackernews-search", {
            key: `hit_${hit.objectID}`,
            label: "HN mention",
            value: `${title} (by ${hit.author})`,
            entityType: "url",
            sourceUrl: storyUrl,
          }));
        }
      }
    } catch { /* ignore */ }

    return { state: findings.length ? "completed" : "no_results", findings };
  },
};
