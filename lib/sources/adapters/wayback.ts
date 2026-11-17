import type { Adapter } from "../../types";
import { fetchWithTimeout } from "../http";
import { mkFinding } from "../util";

// Wayback Machine CDX / availability API – completely free, no key needed.
export const waybackAdapter: Adapter = {
  meta: {
    id: "wayback",
    name: "Wayback Machine",
    category: "archive",
    description: "Internet Archive Wayback Machine: earliest and latest snapshots, total capture count, and CDX index records for a domain.",
    status: "integrated",
    supports: ["domain", "url"],
    authRequired: false,
    privacy: "public",
    docsUrl: "https://archive.org/help/wayback_api.php",
  },
  canRun: ({ identifierType }) => ["domain", "url"].includes(identifierType),
  async run({ normalized, identifierType, signal }) {
    const findings = [];
    const target = identifierType === "url" ? normalized : normalized;

    // Availability API
    try {
      const avail = await fetchWithTimeout(
        `https://archive.org/wayback/available?url=${encodeURIComponent(target)}`,
        { signal, timeoutMs: 10000 }
      );
      if (avail.ok) {
        const d = await avail.json() as { archived_snapshots?: { closest?: { url: string; timestamp: string; status: string } } };
        const snap = d?.archived_snapshots?.closest;
        if (snap) {
          findings.push(mkFinding("wayback", { key: "latest_snapshot", label: "Latest snapshot URL", value: snap.url, entityType: "url", sourceUrl: snap.url }));
          findings.push(mkFinding("wayback", { key: "snapshot_timestamp", label: "Snapshot timestamp", value: snap.timestamp }));
          findings.push(mkFinding("wayback", { key: "snapshot_status", label: "Snapshot HTTP status", value: snap.status }));
        }
      }
    } catch { /* ignore */ }

    // CDX API for total captures and first capture
    try {
      const cdx = await fetchWithTimeout(
        `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&limit=1&fl=timestamp,statuscode,mimetype&from=&to=&fastLatest=true`,
        { signal, timeoutMs: 12000 }
      );
      if (cdx.ok) {
        const rows = await cdx.json() as string[][];
        if (rows.length > 1) {
          const first = rows[1];
          if (first) {
            findings.push(mkFinding("wayback", { key: "first_capture", label: "First captured", value: first[0] || "" }));
            findings.push(mkFinding("wayback", { key: "first_mime", label: "First capture MIME", value: first[2] || "" }));
          }
        }
      }
    } catch { /* ignore */ }

    // Count
    try {
      const count = await fetchWithTimeout(
        `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&limit=1&fl=timestamp&showResumeKey=false&showDupeCount=true&collapse=urlkey`,
        { signal, timeoutMs: 12000 }
      );
      if (count.ok) {
        const rows = await count.json() as string[][];
        if (rows.length > 1 && rows[1]) {
          findings.push(mkFinding("wayback", {
            key: "archive_link",
            label: "View all snapshots",
            value: `https://web.archive.org/web/*/${target}`,
            entityType: "url",
            sourceUrl: `https://web.archive.org/web/*/${target}`,
          }));
        }
      }
    } catch { /* ignore */ }

    return { state: findings.length ? "completed" : "no_results", findings };
  },
};
