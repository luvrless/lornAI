import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// Bluesky (AT Protocol) – public API, no key needed.
// https://docs.bsky.app/
export const blueskyAdapter: Adapter = {
  meta: {
    id: "bluesky",
    name: "Bluesky (AT Protocol)",
    category: "social",
    description: "Public Bluesky profile lookup via the AT Protocol: handle resolution, DID, display name, bio, followers, posts.",
    status: "integrated",
    supports: ["username"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://docs.bsky.app/",
  },
  canRun: ({ identifierType }) => identifierType === "username",
  async run({ normalized, signal }) {
    const handle = normalized.startsWith("@") ? normalized.slice(1) : normalized;
    // Try with .bsky.social suffix if no dot in handle
    const tryHandles = [handle, handle.includes(".") ? null : `${handle}.bsky.social`].filter(Boolean) as string[];

    for (const h of tryHandles) {
      try {
        const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(h)}`;
        const res = await fetchWithTimeout(url, { signal, timeoutMs: 10000 });
        if (!res.ok) continue;
        const d = await res.json() as Record<string, unknown>;
        const profileUrl = `https://bsky.app/profile/${d.handle || h}`;
        const findings = [];
        if (d.handle) findings.push(mkFinding("bluesky", { key: "handle", label: "Bluesky handle", value: `@${d.handle}`, entityType: "username", sourceUrl: profileUrl }));
        if (d.did) findings.push(mkFinding("bluesky", { key: "did", label: "DID", value: String(d.did), sourceUrl: profileUrl }));
        if (d.displayName) findings.push(mkFinding("bluesky", { key: "display_name", label: "Display name", value: String(d.displayName), sourceUrl: profileUrl }));
        if (d.description) findings.push(mkFinding("bluesky", { key: "bio", label: "Bio", value: String(d.description), sourceUrl: profileUrl }));
        if (d.followersCount !== undefined) findings.push(mkFinding("bluesky", { key: "followers", label: "Followers", value: String(d.followersCount), sourceUrl: profileUrl }));
        if (d.followsCount !== undefined) findings.push(mkFinding("bluesky", { key: "following", label: "Following", value: String(d.followsCount), sourceUrl: profileUrl }));
        if (d.postsCount !== undefined) findings.push(mkFinding("bluesky", { key: "posts", label: "Posts", value: String(d.postsCount), sourceUrl: profileUrl }));
        if (d.createdAt) findings.push(mkFinding("bluesky", { key: "created_at", label: "Account created", value: String(d.createdAt), sourceUrl: profileUrl }));
        if (d.avatar) findings.push(mkFinding("bluesky", { key: "avatar", label: "Avatar URL", value: String(d.avatar), entityType: "url" }));
        findings.push(mkFinding("bluesky", { key: "profile", label: "Bluesky profile", value: profileUrl, entityType: "url", sourceUrl: profileUrl }));
        return { state: "completed", findings, raw: d };
      } catch { /* try next */ }
    }
    return { state: "no_results", findings: [], message: "No Bluesky account found" };
  },
};
