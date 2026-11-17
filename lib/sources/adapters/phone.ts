import {
  parsePhoneNumberFromString,
  getExampleNumber,
  AsYouType,
} from "libphonenumber-js";
import type { Adapter, Finding } from "../../types";
import { mkFinding } from "../util";

// Minimal country code → name map for display
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia",
  DE: "Germany", FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands",
  SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", IE: "Ireland",
  IN: "India", JP: "Japan", CN: "China", BR: "Brazil", MX: "Mexico",
  RU: "Russia", ZA: "South Africa", NG: "Nigeria", KE: "Kenya", AE: "UAE",
  SA: "Saudi Arabia", SG: "Singapore", HK: "Hong Kong", KR: "South Korea",
  PL: "Poland", PT: "Portugal", CH: "Switzerland", AT: "Austria", BE: "Belgium",
};

export const phoneAdapter: Adapter = {
  meta: {
    id: "phone-metadata",
    name: "Phone Number Metadata",
    category: "phone",
    description:
      "Parses and validates a phone number: E.164 normalization, country, calling code, national format and line type — all offline from public numbering plans.",
    status: "integrated",
    supports: ["phone"],
    authRequired: false,
    privacy: "public",
  },
  canRun: ({ identifierType }) => identifierType === "phone",
  async run({ input, normalized }) {
    const phone =
      parsePhoneNumberFromString(normalized) ||
      parsePhoneNumberFromString(input, "US");
    if (!phone) {
      return { state: "no_results", findings: [], message: "Could not parse number" };
    }
    const findings: Finding[] = [];
    findings.push(mkFinding("phone-metadata", { key: "valid", label: "Valid number", value: phone.isValid() ? "yes" : "no (possible: " + phone.isPossible() + ")", confidence: 1 }));
    findings.push(mkFinding("phone-metadata", { key: "e164", label: "International (E.164)", value: phone.number, confidence: 1 }));
    findings.push(mkFinding("phone-metadata", { key: "national", label: "National format", value: phone.formatNational(), confidence: 0.95 }));
    findings.push(mkFinding("phone-metadata", { key: "calling_code", label: "Calling code", value: "+" + phone.countryCallingCode, confidence: 1 }));
    if (phone.country) {
      findings.push(
        mkFinding("phone-metadata", {
          key: "country",
          label: "Country",
          value: `${COUNTRY_NAMES[phone.country] || phone.country} (${phone.country})`,
          confidence: 0.95,
        })
      );
    }
    const type = phone.getType();
    if (type)
      findings.push(mkFinding("phone-metadata", { key: "line_type", label: "Line type", value: String(type).replace(/_/g, " ").toLowerCase(), confidence: 0.8 }));

    // Live typing format as a sanity display
    findings.push(
      mkFinding("phone-metadata", {
        key: "formatted",
        label: "International display",
        value: phone.formatInternational(),
        confidence: 0.95,
      })
    );
    void getExampleNumber;
    void AsYouType;

    return {
      state: "completed",
      findings,
      raw: {
        number: phone.number,
        country: phone.country,
        type: phone.getType(),
        valid: phone.isValid(),
      },
    };
  },
};
