import type { SourceMeta } from "../types";

// Registry of additional source slots. These are REAL providers with their
// honest integration status. They are NOT executed with fake data: a source is
// only run when it has a working adapter. Everything here is "requires_key",
// "public_web" (planned scraper) or "planned". This gives the platform an
// expandable 150+ source registry without fabricating results.

type P = Omit<SourceMeta, "supports"> & { supports: SourceMeta["supports"] };

function m(
  id: string,
  name: string,
  category: SourceMeta["category"],
  status: SourceMeta["status"],
  supports: SourceMeta["supports"],
  description: string,
  authRequired: boolean,
  privacy: SourceMeta["privacy"],
  docsUrl?: string
): P {
  return { id, name, category, status, supports, description, authRequired, privacy, docsUrl };
}

export const PLANNED_SOURCES: SourceMeta[] = [
  // --- Breach / exposure (defensive) ---
  m("dehashed", "DeHashed", "breach", "requires_key", ["email", "username", "ip"], "Breach-exposure metadata lookup (defensive).", true, "defensive", "https://dehashed.com/docs"),
  m("leakcheck", "LeakCheck", "breach", "requires_key", ["email", "username"], "Breach presence notification by account.", true, "defensive", "https://leakcheck.io/api"),
  m("intelx", "Intelligence X", "breach", "requires_key", ["email", "domain", "ip"], "Selector-based public exposure index.", true, "defensive", "https://intelx.io/product"),
  m("snusbase", "Snusbase", "breach", "requires_key", ["email", "username"], "Breach notification metadata.", true, "defensive"),
  m("hunterio", "Hunter.io", "email", "requires_key", ["email", "domain"], "Email deliverability and domain pattern verification.", true, "public", "https://hunter.io/api-documentation"),
  m("emailrep", "EmailRep", "email", "requires_key", ["email"], "Email reputation and risk signal.", true, "defensive", "https://emailrep.io/"),
  m("firehol", "FireHOL IP Lists", "threat", "planned", ["ip"], "Aggregated public IP threat lists.", false, "defensive", "https://iplists.firehol.org/"),

  // --- Advisories / vulnerabilities ---
  m("nvd", "NVD (NIST)", "advisory", "planned", ["organization", "domain"], "Public CVE / vulnerability advisories.", false, "public", "https://nvd.nist.gov/developers"),
  m("osv", "OSV.dev", "advisory", "planned", ["organization"], "Open-source vulnerability database.", false, "public", "https://osv.dev/"),
  m("cisa-kev", "CISA KEV", "advisory", "planned", ["organization"], "Known Exploited Vulnerabilities catalog.", false, "public", "https://www.cisa.gov/kev"),
  m("ghsa", "GitHub Advisories", "advisory", "requires_key", ["organization"], "GitHub Security Advisory database.", true, "public", "https://docs.github.com/graphql"),

  // --- Threat / malware / phishing ---
  m("virustotal", "VirusTotal", "threat", "requires_key", ["domain", "ip", "url", "hash"], "File/URL/domain/IP reputation and detections.", true, "defensive", "https://developers.virustotal.com/"),
  m("abuseipdb", "AbuseIPDB", "threat", "requires_key", ["ip"], "Crowd-sourced IP abuse reports.", true, "defensive", "https://docs.abuseipdb.com/"),
  m("threatfox", "ThreatFox (abuse.ch)", "threat", "requires_key", ["ip", "domain", "hash"], "IOC exchange.", true, "defensive", "https://threatfox.abuse.ch/api/"),
  m("phishtank", "PhishTank", "phishing", "requires_key", ["url", "domain"], "Community phishing URL database.", true, "defensive", "https://phishtank.org/api_info.php"),
  m("openphish", "OpenPhish", "phishing", "planned", ["url", "domain"], "Phishing intelligence feed.", false, "defensive", "https://openphish.com/"),
  m("greynoise", "GreyNoise", "threat", "requires_key", ["ip"], "Internet background-noise scanner classification.", true, "defensive", "https://docs.greynoise.io/"),
  m("alienvault-otx", "AlienVault OTX", "threat", "requires_key", ["ip", "domain", "hash"], "Open Threat Exchange pulses.", true, "defensive", "https://otx.alienvault.com/api"),

  // --- DNS / subdomains / infra ---
  m("securitytrails", "SecurityTrails", "subdomains", "requires_key", ["domain", "ip"], "Historical DNS and subdomain inventory.", true, "public", "https://docs.securitytrails.com/"),
  m("shodan", "Shodan", "ip", "requires_key", ["ip", "domain"], "Internet-exposed service and banner data.", true, "defensive", "https://developer.shodan.io/"),
  m("censys", "Censys", "ip", "requires_key", ["ip", "domain"], "Host and certificate scanning.", true, "defensive", "https://search.censys.io/api"),
  m("binaryedge", "BinaryEdge", "ip", "requires_key", ["ip", "domain"], "Exposure and scan data.", true, "defensive", "https://docs.binaryedge.io/"),
  m("viewdns", "ViewDNS.info", "dns", "requires_key", ["domain", "ip"], "Reverse IP, DNS history, WHOIS tools.", true, "public", "https://viewdns.info/api/"),
  m("dnsdumpster", "DNSDumpster", "subdomains", "public_web", ["domain"], "Passive subdomain discovery.", false, "public", "https://dnsdumpster.com/"),
  m("peeringdb", "PeeringDB", "asn", "planned", ["organization"], "Network operator and facility registry.", false, "public", "https://www.peeringdb.com/apidocs/"),
  m("ipinfo", "IPinfo", "ip", "requires_key", ["ip"], "Geolocation, ASN and privacy detection.", true, "public", "https://ipinfo.io/developers"),
  m("ipqualityscore", "IPQualityScore", "ip", "requires_key", ["ip", "email", "phone", "url"], "Fraud/VPN/proxy scoring.", true, "defensive", "https://www.ipqualityscore.com/documentation"),
  m("whoisxml", "WhoisXML API", "whois", "requires_key", ["domain"], "WHOIS, DNS and subdomain datasets.", true, "public", "https://whoisxmlapi.com/"),

  // --- Phone ---
  m("numverify", "numverify", "phone", "requires_key", ["phone"], "Carrier and line-type validation.", true, "public", "https://numverify.com/documentation"),
  m("twilio-lookup", "Twilio Lookup", "phone", "requires_key", ["phone"], "Carrier, line type and caller name.", true, "public", "https://www.twilio.com/docs/lookup"),

  // --- Search / web / archive / news ---
  m("google-cse", "Google Programmable Search", "search_engine", "requires_key", ["organization", "username", "domain"], "Custom web search.", true, "public", "https://developers.google.com/custom-search"),
  m("bing-search", "Bing Web Search", "search_engine", "requires_key", ["organization", "username", "domain"], "Web search API.", true, "public", "https://learn.microsoft.com/bing/search-apis/"),
  m("serpapi", "SerpAPI", "search_engine", "requires_key", ["organization", "username"], "Aggregated SERP scraping.", true, "public", "https://serpapi.com/"),
  m("commoncrawl", "Common Crawl", "web_index", "planned", ["domain"], "Public web-scale crawl index.", false, "public", "https://commoncrawl.org/"),
  m("gdelt", "GDELT", "news", "planned", ["organization"], "Global news event index.", false, "public", "https://www.gdeltproject.org/"),
  m("newsapi", "NewsAPI", "news", "requires_key", ["organization"], "News article search.", true, "public", "https://newsapi.org/docs"),

  // --- Company / org / gov ---
  m("sec-edgar", "SEC EDGAR", "org_records", "planned", ["organization"], "US public-company filings.", false, "public", "https://www.sec.gov/edgar/sec-api-documentation"),
  m("companies-house", "UK Companies House", "company_registry", "requires_key", ["organization"], "UK company registry.", true, "public", "https://developer.company-information.service.gov.uk/"),
  m("clearbit", "Clearbit", "org_records", "requires_key", ["domain", "email"], "Company and domain enrichment.", true, "public", "https://dashboard.clearbit.com/docs"),

  // --- Developer / code / packages ---
  m("stackexchange", "Stack Exchange", "developer", "requires_key", ["username"], "Public developer Q&A profiles.", true, "public", "https://api.stackexchange.com/"),
  m("sourcegraph", "Sourcegraph", "code_search", "requires_key", ["organization"], "Public code search.", true, "public", "https://docs.sourcegraph.com/api"),
  m("grep-app", "grep.app", "code_search", "public_web", ["organization"], "Cross-repo public code search.", false, "public", "https://grep.app/"),
  m("libraries-io", "Libraries.io", "package_registry", "requires_key", ["organization"], "Package metadata across registries.", true, "public", "https://libraries.io/api"),
  m("rubygems", "RubyGems", "package_registry", "planned", ["username"], "Public gem owner lookup.", false, "public", "https://guides.rubygems.org/rubygems-org-api/"),
  m("packagist", "Packagist", "package_registry", "planned", ["username"], "PHP package maintainer lookup.", false, "public", "https://packagist.org/apidoc"),

  // --- Social (needs key / ToS-gated) ---
  m("reddit-oauth", "Reddit API (OAuth)", "social", "requires_key", ["username"], "Authenticated Reddit profile/activity.", true, "public", "https://www.reddit.com/dev/api"),
  m("mastodon-search", "Mastodon (federated)", "social", "public_web", ["username"], "Public fediverse account lookup.", false, "public", "https://docs.joinmastodon.org/api/"),
  m("youtube-data", "YouTube Data API", "social", "requires_key", ["username"], "Public channel metadata.", true, "public", "https://developers.google.com/youtube/v3"),
  m("twitch-api", "Twitch API", "social", "requires_key", ["username"], "Public channel/user metadata.", true, "public", "https://dev.twitch.tv/docs/api/"),

  // --- Image / media / geo ---
  m("exiftool", "EXIF Metadata Extractor", "image_meta", "planned", ["url"], "On-upload EXIF/metadata extraction.", false, "public", "https://exiftool.org/"),
  m("tineye", "TinEye", "image_meta", "requires_key", ["url"], "Reverse image search.", true, "public", "https://services.tineye.com/"),
  m("google-vision", "Google Vision", "ocr", "requires_key", ["url"], "OCR, landmark and label detection.", true, "sensitive", "https://cloud.google.com/vision/docs"),
  m("nominatim", "OpenStreetMap Nominatim", "geo", "planned", ["organization"], "Geocoding of place names.", false, "public", "https://nominatim.org/release-docs/latest/api/Overview/"),
  m("overpass", "Overpass (OSM)", "maps", "planned", ["organization"], "OpenStreetMap feature queries.", false, "public", "https://wiki.openstreetmap.org/wiki/Overpass_API"),

  // --- Academic / documents ---
  m("openalex", "OpenAlex", "academic", "planned", ["organization"], "Open scholarly graph.", false, "public", "https://docs.openalex.org/"),

  // --- URL / file reputation ---
  m("safebrowsing", "Google Safe Browsing", "url_reputation", "requires_key", ["url"], "Malicious URL classification.", true, "defensive", "https://developers.google.com/safe-browsing"),
  m("maltiverse", "Maltiverse", "threat", "requires_key", ["ip", "domain", "url", "hash"], "IOC reputation.", true, "defensive", "https://maltiverse.com/"),

  // --- Crypto ---
  m("etherscan", "Etherscan", "crypto", "requires_key", ["wallet"], "Ethereum address activity.", true, "public", "https://docs.etherscan.io/"),
  m("blockchair", "Blockchair", "crypto", "requires_key", ["wallet"], "Multi-chain address analytics.", true, "public", "https://blockchair.com/api/docs"),

  // --- Extended registry: additional genuine providers (status-honest) ---
  m("fullcontact", "FullContact", "org_records", "requires_key", ["email", "domain"], "Identity and company enrichment.", true, "public", "https://platform.fullcontact.com/docs"),
  m("peopledatalabs", "People Data Labs", "org_records", "requires_key", ["email", "organization"], "B2B enrichment (public/consented).", true, "sensitive", "https://docs.peopledatalabs.com/"),
  m("verifalia", "Verifalia", "email", "requires_key", ["email"], "Email deliverability verification.", true, "public", "https://verifalia.com/developers"),
  m("mailboxlayer", "mailboxlayer", "email", "requires_key", ["email"], "SMTP/MX email validation.", true, "public", "https://mailboxlayer.com/documentation"),
  m("kickbox", "Kickbox", "email", "requires_key", ["email"], "Email verification and risk.", true, "public", "https://docs.kickbox.com/"),
  m("haveibeensold", "Firefox Monitor", "breach", "planned", ["email"], "Breach notification (HIBP-backed).", false, "defensive", "https://monitor.firefox.com/"),
  m("spycloud", "SpyCloud", "breach", "requires_key", ["email", "domain"], "Account takeover exposure (enterprise).", true, "defensive", "https://spycloud.com/"),
  m("constella", "Constella Intelligence", "breach", "requires_key", ["email", "username"], "Identity exposure monitoring.", true, "defensive"),
  m("flare", "Flare", "threat", "requires_key", ["domain", "email"], "Dark/clear web exposure monitoring.", true, "defensive", "https://flare.io/"),
  m("pulsedive", "Pulsedive", "threat", "requires_key", ["ip", "domain", "url"], "Threat indicator enrichment.", true, "defensive", "https://pulsedive.com/api/"),
  m("misp", "MISP (self-hosted)", "threat", "requires_key", ["ip", "domain", "hash"], "Self-hosted threat-sharing platform.", true, "defensive", "https://www.misp-project.org/"),
  m("spur", "Spur", "ip", "requires_key", ["ip"], "VPN/proxy/anonymization detection.", true, "defensive", "https://spur.us/"),
  m("ip2location", "IP2Location", "ip", "requires_key", ["ip"], "Geolocation database.", true, "public", "https://www.ip2location.com/"),
  m("maxmind", "MaxMind GeoIP2", "geo", "requires_key", ["ip"], "Geolocation and anonymizer data.", true, "public", "https://dev.maxmind.com/"),
  m("robtex", "Robtex", "dns", "public_web", ["domain", "ip"], "DNS and network relationship data.", false, "public", "https://www.robtex.com/api/"),
  m("threatcrowd", "ThreatCrowd", "threat", "planned", ["domain", "ip", "email"], "Open threat graph (legacy).", false, "defensive"),
  m("circl-pdns", "CIRCL Passive DNS", "dns", "requires_key", ["domain", "ip"], "Historical passive DNS.", true, "defensive", "https://www.circl.lu/services/passive-dns/"),
  m("circl-pssl", "CIRCL Passive SSL", "certificates", "requires_key", ["ip"], "Historical certificate observations.", true, "defensive", "https://www.circl.lu/services/passive-ssl/"),
  m("certspotter", "Cert Spotter", "certificates", "planned", ["domain"], "Certificate transparency monitoring.", false, "public", "https://sslmate.com/certspotter/"),
  m("facebook-ct", "Facebook CT", "certificates", "requires_key", ["domain"], "CT monitoring API.", true, "public", "https://developers.facebook.com/docs/certificate-transparency"),
  m("riddler", "Riddler/F-Secure", "dns", "requires_key", ["domain", "ip"], "Host/IP relationship data.", true, "defensive"),
  m("onyphe", "ONYPHE", "ip", "requires_key", ["ip", "domain"], "Cyber-defense search engine.", true, "defensive", "https://www.onyphe.io/"),
  m("fofa", "FOFA", "ip", "requires_key", ["ip", "domain"], "Internet asset search.", true, "defensive", "https://en.fofa.info/"),
  m("zoomeye", "ZoomEye", "ip", "requires_key", ["ip", "domain"], "Cyberspace search engine.", true, "defensive", "https://www.zoomeye.org/doc"),
  m("netlas", "Netlas", "ip", "requires_key", ["ip", "domain"], "Internet scan and responses.", true, "defensive", "https://netlas.io/"),
  m("whoxy", "Whoxy", "whois", "requires_key", ["domain"], "WHOIS history and reverse WHOIS.", true, "public", "https://www.whoxy.com/"),
  m("domaintools", "DomainTools", "whois", "requires_key", ["domain", "ip"], "Domain/DNS intelligence.", true, "public", "https://www.domaintools.com/resources/api-documentation/"),
  m("spamhaus-dqs", "Spamhaus DQS", "domain_reputation", "requires_key", ["domain", "ip"], "Data Query Service reputation.", true, "defensive", "https://www.spamhaus.com/"),
  m("talos", "Cisco Talos", "domain_reputation", "public_web", ["domain", "ip"], "Reputation center.", false, "defensive", "https://talosintelligence.com/"),
  m("safebrowsing-cache", "URLVoid", "url_reputation", "requires_key", ["domain", "url"], "Multi-engine domain reputation.", true, "defensive", "https://www.urlvoid.com/"),
  m("hybrid-analysis", "Hybrid Analysis", "malware", "requires_key", ["hash", "url"], "Sandbox malware analysis.", true, "defensive", "https://www.hybrid-analysis.com/docs/api/v2"),
  m("anyrun", "ANY.RUN", "malware", "requires_key", ["hash", "url"], "Interactive malware sandbox.", true, "defensive", "https://any.run/"),
  m("triage", "Hatching Triage", "malware", "requires_key", ["hash"], "Automated malware analysis.", true, "defensive", "https://tria.ge/"),
  m("inquest", "InQuest Labs", "malware", "requires_key", ["hash", "domain"], "File and indicator intelligence.", true, "defensive", "https://labs.inquest.net/"),
  m("github-code", "GitHub Code Search", "code_search", "requires_key", ["organization", "email"], "Search public code (leak hunting, defensive).", true, "public", "https://docs.github.com/search-github/searching-on-github/searching-code"),
  m("gitlab-snippets", "GitLab Snippets", "code_search", "public_web", ["organization"], "Public snippet search.", false, "public"),
  m("pastebin-scrape", "Paste sites (public)", "web_index", "planned", ["email", "username"], "Public paste indexing (defensive leak hunting).", false, "defensive"),
  m("duckduckgo", "DuckDuckGo", "search_engine", "public_web", ["organization", "username"], "Instant-answer and HTML search.", false, "public", "https://duckduckgo.com/api"),
  m("brave-search", "Brave Search", "search_engine", "requires_key", ["organization", "username"], "Independent web index.", true, "public", "https://brave.com/search/api/"),
  m("yandex-search", "Yandex Search", "search_engine", "requires_key", ["organization"], "Web search API.", true, "public"),
  m("archive-today", "archive.today", "archive", "public_web", ["url"], "Page snapshot service.", false, "public", "https://archive.ph/"),
  m("mementoweb", "Memento Time Travel", "archive", "planned", ["url"], "Aggregated web archives.", false, "public", "http://timetravel.mementoweb.org/"),
  m("hn-algolia", "HN Search (Algolia)", "forum", "planned", ["username", "organization"], "Full-text Hacker News search.", false, "public", "https://hn.algolia.com/api"),
  m("pushshift", "Reddit archives", "forum", "requires_key", ["username"], "Historical Reddit content (restricted).", true, "public"),
  m("wikipedia", "Wikipedia/MediaWiki", "gov_data", "planned", ["organization"], "Public encyclopedia lookups.", false, "public", "https://www.mediawiki.org/wiki/API:Main_page"),
  m("usaspending", "USAspending.gov", "gov_data", "planned", ["organization"], "US federal spending records.", false, "public", "https://api.usaspending.gov/"),
  m("sanctions-ofac", "OFAC Sanctions", "gov_data", "planned", ["organization"], "US sanctions list screening.", false, "public", "https://sanctionslist.ofac.treas.gov/"),
  m("opensanctions", "OpenSanctions", "gov_data", "requires_key", ["organization"], "Global sanctions/PEP data.", true, "public", "https://www.opensanctions.org/docs/api/"),
  m("gleif", "GLEIF LEI", "company_registry", "planned", ["organization"], "Legal Entity Identifier registry.", false, "public", "https://www.gleif.org/en/lei-data/gleif-api"),
  m("abstract-phone", "Abstract Phone Validation", "phone", "requires_key", ["phone"], "Phone validation and carrier.", true, "public", "https://www.abstractapi.com/phone-validation-api"),
  m("veriphone", "Veriphone", "phone", "requires_key", ["phone"], "Phone validation API.", true, "public", "https://veriphone.io/"),
  m("truecaller", "Caller-ID providers", "phone", "requires_key", ["phone"], "Public business caller-ID (ToS-gated).", true, "sensitive"),
  m("gravatar-api", "Gravatar API", "social", "planned", ["email"], "Public avatar/profile by email hash.", false, "public", "https://docs.gravatar.com/"),
  m("keybase-api", "Keybase API", "social", "public_web", ["username"], "Public cryptographic identity proofs.", false, "public", "https://keybase.io/docs/api/1.0"),
  m("wappalyzer", "Wappalyzer", "tech_fingerprint", "requires_key", ["domain", "url"], "Technology stack detection.", true, "public", "https://www.wappalyzer.com/api/"),
  m("builtwith", "BuiltWith", "tech_fingerprint", "requires_key", ["domain"], "Technology profiling.", true, "public", "https://api.builtwith.com/"),
  m("retire-js", "Retire.js checks", "tech_fingerprint", "planned", ["url"], "Vulnerable JS library detection.", false, "defensive", "https://retirejs.github.io/retire.js/"),
  m("mozilla-observatory", "Mozilla Observatory", "domain_reputation", "planned", ["domain"], "Web security posture grading.", false, "defensive", "https://observatory.mozilla.org/"),
  m("ssllabs", "SSL Labs", "certificates", "public_web", ["domain"], "TLS configuration grading.", false, "defensive", "https://www.ssllabs.com/projects/ssllabs-apis/"),
  m("hardenize", "Hardenize", "certificates", "requires_key", ["domain"], "Network/security posture.", true, "defensive"),
  m("crtsh-pg", "crt.sh (Postgres)", "certificates", "planned", ["domain"], "Direct CT log SQL interface.", false, "public", "https://crt.sh/"),
  m("virustotal-graph", "VirusTotal Graph", "threat", "requires_key", ["domain", "ip", "hash"], "Relationship graph pivoting.", true, "defensive", "https://developers.virustotal.com/"),
  m("silentpush", "Silent Push", "dns", "requires_key", ["domain", "ip"], "Infrastructure intelligence.", true, "defensive", "https://www.silentpush.com/"),
  m("validin", "Validin", "dns", "requires_key", ["domain", "ip"], "DNS/host history.", true, "defensive", "https://www.validin.com/"),
  m("hunter-verify", "Hunter Verifier", "email", "requires_key", ["email"], "Deliverability verification.", true, "public", "https://hunter.io/api-documentation"),
  m("emailhippo", "Email Hippo", "email", "requires_key", ["email"], "Email verification and risk.", true, "public", "https://www.emailhippo.com/"),
  m("zerobounce", "ZeroBounce", "email", "requires_key", ["email"], "Email validation and scoring.", true, "public", "https://www.zerobounce.net/docs/"),
  m("neutrino", "Neutrino API", "phone", "requires_key", ["phone", "ip", "email"], "Multi-purpose validation suite.", true, "public", "https://www.neutrinoapi.com/"),
  m("ipapi-co", "ipapi.co", "ip", "public_web", ["ip"], "Geolocation (rate-limited public).", false, "public", "https://ipapi.co/api/"),
  m("ipdata", "ipdata.co", "ip", "requires_key", ["ip"], "Geolocation and threat data.", true, "public", "https://docs.ipdata.co/"),
];
