import type { Adapter, SourceMeta, IdentifierType } from "../types";
import { PLANNED_SOURCES } from "./planned";

import { emailSyntaxAdapter } from "./adapters/emailSyntax";
import { disposableAdapter } from "./adapters/disposable";
import { dnsRecordsAdapter } from "./adapters/dnsRecords";
import { emailAuthAdapter } from "./adapters/emailAuth";
import { rdapDomainAdapter } from "./adapters/rdapDomain";
import { rdapIpAdapter } from "./adapters/rdapIp";
import { crtshAdapter } from "./adapters/crtsh";
import { reverseDnsAdapter } from "./adapters/reverseDns";
import { httpHeadersAdapter } from "./adapters/httpHeaders";
import { tlsCertAdapter } from "./adapters/tlsCert";
import { phoneAdapter } from "./adapters/phone";
import { usernameAdapter } from "./adapters/username";
import { ipGeoAdapter } from "./adapters/ipGeo";
import { dnsblAdapter } from "./adapters/dnsbl";
import { btcAdapter } from "./adapters/btc";
import { hibpBreachAdapter } from "./adapters/hibpBreach";
import { shodanAdapter } from "./adapters/shodan";
import { hackerTargetAdapter } from "./adapters/hackerTarget";
import { waybackAdapter } from "./adapters/wayback";
import { bgpViewAdapter } from "./adapters/bgpView";
import { gravatarAdapter } from "./adapters/gravatar";
import { urlscanAdapter } from "./adapters/urlscan";
import { githubAdapter } from "./adapters/github";
import { gitlabAdapter } from "./adapters/gitlab";
import { blueskyAdapter } from "./adapters/bluesky";
import { npmAdapter } from "./adapters/npm";
import { ethAdapter } from "./adapters/ethAddress";
import { hnAdapter } from "./adapters/hackerNews";
import { keybaseAdapter } from "./adapters/keybase";
import { urlhausAdapter } from "./adapters/urlhaus";
import { malwareBazaarAdapter } from "./adapters/malwareBazaar";
import { circlPdnsAdapter } from "./adapters/circlPdns";
import { cratesAdapter } from "./adapters/cratesIo";
import { orcidAdapter } from "./adapters/orcid";
import { wikiDataAdapter } from "./adapters/wikiData";
import { openCorporatesAdapter } from "./adapters/openCorporates";
import { crossRefAdapter } from "./adapters/crossRef";

// All executable adapters (real implementations).
export const ADAPTERS: Adapter[] = [
  emailSyntaxAdapter,
  disposableAdapter,
  dnsRecordsAdapter,
  emailAuthAdapter,
  rdapDomainAdapter,
  rdapIpAdapter,
  crtshAdapter,
  reverseDnsAdapter,
  httpHeadersAdapter,
  tlsCertAdapter,
  phoneAdapter,
  usernameAdapter,
  ipGeoAdapter,
  dnsblAdapter,
  btcAdapter,
  hibpBreachAdapter,
  shodanAdapter,
  hackerTargetAdapter,
  waybackAdapter,
  bgpViewAdapter,
  gravatarAdapter,
  urlscanAdapter,
  githubAdapter,
  gitlabAdapter,
  blueskyAdapter,
  npmAdapter,
  ethAdapter,
  hnAdapter,
  keybaseAdapter,
  urlhausAdapter,
  malwareBazaarAdapter,
  circlPdnsAdapter,
  cratesAdapter,
  orcidAdapter,
  wikiDataAdapter,
  openCorporatesAdapter,
  crossRefAdapter,
];

export const ADAPTER_MAP = new Map(ADAPTERS.map((a) => [a.meta.id, a]));

// Full registry (executable metas + planned/keyed slots) for the Sources page.
export const ALL_SOURCE_METAS: SourceMeta[] = [
  ...ADAPTERS.map((a) => a.meta),
  ...PLANNED_SOURCES,
];

export function registryStats() {
  const by = (s: SourceMeta["status"]) =>
    ALL_SOURCE_METAS.filter((m) => m.status === s).length;
  return {
    total: ALL_SOURCE_METAS.length,
    integrated: by("integrated"),
    requires_key: by("requires_key"),
    public_web: by("public_web"),
    planned: by("planned"),
    unavailable: by("unavailable"),
  };
}

export function metaById(id: string): SourceMeta | undefined {
  return ALL_SOURCE_METAS.find((m) => m.id === id);
}

// Which executable adapters apply to a given identifier
export function eligibleAdapters(
  identifierType: IdentifierType,
  normalized: string,
  disabled: Set<string> = new Set()
): Adapter[] {
  return ADAPTERS.filter(
    (a) => !disabled.has(a.meta.id) && a.canRun({ identifierType, normalized })
  );
}

// Planned/keyed sources that *would* apply (shown as skipped/needs-config)
export function eligiblePlanned(identifierType: IdentifierType): SourceMeta[] {
  return PLANNED_SOURCES.filter((m) => m.supports.includes(identifierType));
}
