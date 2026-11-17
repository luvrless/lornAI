import type { Adapter, Finding } from "../../types";
import { fetchWithTimeout, SourceError } from "../http";
import { mkFinding } from "../util";

interface IpWho {
  success?: boolean;
  type?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  connection?: { asn?: number; org?: string; isp?: string; domain?: string };
  flag?: unknown;
  message?: string;
}

export const ipGeoAdapter: Adapter = {
  meta: {
    id: "ip-geo",
    name: "IP Geolocation & ASN (ipwho.is)",
    category: "ip",
    description:
      "Country/region-level geolocation plus ASN, ISP and hosting organization. Geolocation is approximate and never pinpoints a person.",
    status: "integrated",
    supports: ["ip"],
    docsUrl: "https://ipwho.is/",
    authRequired: false,
    privacy: "public",
    rateLimit: "~10k/month free, best-effort",
  },
  canRun: ({ identifierType }) => identifierType === "ip",
  async run({ normalized, signal }) {
    const res = await fetchWithTimeout(`https://ipwho.is/${encodeURIComponent(normalized)}`, {
      signal,
      timeoutMs: 10000,
    });
    if (res.status === 429) throw new SourceError("rate limited", "rate_limited");
    if (!res.ok) throw new SourceError(`HTTP ${res.status}`, "unavailable");
    const d = (await res.json()) as IpWho;
    if (d.success === false)
      return { state: "no_results", findings: [], message: d.message || "No data" };
    const findings: Finding[] = [];
    const loc = [d.city, d.region, d.country].filter(Boolean).join(", ");
    if (loc)
      findings.push(mkFinding("ip-geo", { key: "geo_location", label: "Approx. location", value: `${loc} (country/region accuracy only)`, confidence: 0.6 }));
    if (d.country_code)
      findings.push(mkFinding("ip-geo", { key: "geo_country", label: "Country", value: `${d.country} (${d.country_code})`, confidence: 0.75 }));
    if (d.connection?.asn)
      findings.push(mkFinding("ip-geo", { key: "asn", label: "ASN", value: `AS${d.connection.asn}`, confidence: 0.85 }));
    if (d.connection?.org)
      findings.push(mkFinding("ip-geo", { key: "asn_org", label: "AS organization", value: d.connection.org, confidence: 0.8 }));
    if (d.connection?.isp)
      findings.push(mkFinding("ip-geo", { key: "isp", label: "ISP", value: d.connection.isp, confidence: 0.8 }));
    if (d.type)
      findings.push(mkFinding("ip-geo", { key: "ip_type", label: "IP version", value: d.type, confidence: 0.9 }));
    if (typeof d.latitude === "number" && typeof d.longitude === "number")
      findings.push(
        mkFinding("ip-geo", {
          key: "geo_coords",
          label: "Centroid (approx.)",
          value: `${d.latitude.toFixed(3)}, ${d.longitude.toFixed(3)}`,
          confidence: 0.5,
          extra: { lat: d.latitude, lon: d.longitude },
        })
      );

    return { state: "completed", findings, raw: { ...d, flag: undefined } };
  },
};
