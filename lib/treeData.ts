// Comprehensive OSINT Framework Tree Data Structure
// Covering all domains from username, email, domain, IP, business, social, to dark web and archives.

export interface TreeNode {
  id: string;
  name: string;
  type?: "category" | "tool" | "source";
  url?: string;
  identifierType?: string;
  description?: string;
  children?: TreeNode[];
}

export const OSINT_FRAMEWORK_TREE: TreeNode = {
  id: "root",
  name: "OSINT Framework",
  type: "category",
  children: [
    {
      id: "username",
      name: "Username",
      type: "category",
      children: [
        {
          id: "username-search",
          name: "Username Search Engines",
          type: "category",
          children: [
            { id: "u-lorn", name: "Lorn.lol Multi-Platform Enum (40+ sites)", type: "source", identifierType: "username", description: "Direct deep multi-platform check" },
            { id: "u-whatsmyname", name: "WhatsMyName.app", type: "tool", url: "https://whatsmyname.app/" },
            { id: "u-sherlock", name: "Sherlock Project", type: "tool", url: "https://sherlock-project.github.io/" },
            { id: "u-namecheckr", name: "Namecheckr", type: "tool", url: "https://www.namecheckr.com/" },
            { id: "u-instantusername", name: "Instant Username Search", type: "tool", url: "https://instantusername.com/" },
            { id: "u-checkuser", name: "CheckUser", type: "tool", url: "https://checkuser.org/" },
            { id: "u-usersearch", name: "UserSearch.org", type: "tool", url: "https://usersearch.org/" }
          ]
        },
        {
          id: "username-social",
          name: "Social Networks",
          type: "category",
          children: [
            { id: "u-github", name: "GitHub Public Profiles", type: "source", identifierType: "username" },
            { id: "u-reddit", name: "Reddit User Analysis", type: "source", identifierType: "username" },
            { id: "u-bluesky", name: "Bluesky AT Protocol", type: "source", identifierType: "username" },
            { id: "u-keybase", name: "Keybase Cryptographic Proofs", type: "source", identifierType: "username" },
            { id: "u-gitlab", name: "GitLab Activity & Repos", type: "source", identifierType: "username" },
            { id: "u-crates", name: "crates.io Package Owners", type: "source", identifierType: "username" },
            { id: "u-npm", name: "npm Registry Maintainers", type: "source", identifierType: "username" }
          ]
        }
      ]
    },
    {
      id: "email",
      name: "Email Address",
      type: "category",
      children: [
        {
          id: "email-verification",
          name: "Email Verification & Syntax",
          type: "category",
          children: [
            { id: "e-syntax", name: "RFC 5322 Syntax & Domain Validation", type: "source", identifierType: "email" },
            { id: "e-disposable", name: "Disposable/Burner Detection (4,000+ domains)", type: "source", identifierType: "email" },
            { id: "e-auth", name: "MX, SPF, DMARC Deliverability Check", type: "source", identifierType: "email" },
            { id: "e-mail-tester", name: "Mail-Tester", type: "tool", url: "https://www.mail-tester.com/" },
            { id: "e-hunter", name: "Hunter.io Verifier", type: "tool", url: "https://hunter.io/verify" }
          ]
        },
        {
          id: "email-breach",
          name: "Breach & Exposure Lookup",
          type: "category",
          children: [
            { id: "e-hibp", name: "Have I Been Pwned? Database", type: "source", identifierType: "email" },
            { id: "e-leakcheck", name: "LeakCheck Public API", type: "tool", url: "https://leakcheck.io/" },
            { id: "e-dehashed", name: "DeHashed Breach Records", type: "tool", url: "https://dehashed.com/" },
            { id: "e-intelx", name: "Intelligence X Exposure", type: "tool", url: "https://intelx.io/" }
          ]
        },
        {
          id: "email-profiles",
          name: "Account & Profile Association",
          type: "category",
          children: [
            { id: "e-gravatar", name: "Gravatar MD5 Profile & Linked Accounts", type: "source", identifierType: "email" },
            { id: "e-gh-commits", name: "GitHub Public Commit Author Matching", type: "source", identifierType: "email" },
            { id: "e-orcid", name: "ORCID Researcher Lookup", type: "source", identifierType: "email" }
          ]
        }
      ]
    },
    {
      id: "domain",
      name: "Domain Name",
      type: "category",
      children: [
        {
          id: "domain-subdomains",
          name: "Subdomains & CT Logs",
          type: "category",
          children: [
            { id: "d-crtsh", name: "crt.sh Certificate Transparency Logs", type: "source", identifierType: "domain" },
            { id: "d-hackertarget", name: "HackerTarget Subdomain Finder", type: "source", identifierType: "domain" },
            { id: "d-urlscan", name: "URLScan.io Scans & Domains", type: "source", identifierType: "domain" },
            { id: "d-sublist3r", name: "Sublist3r", type: "tool", url: "https://github.com/aboul3la/Sublist3r" }
          ]
        },
        {
          id: "domain-whois",
          name: "WHOIS & RDAP Records",
          type: "category",
          children: [
            { id: "d-rdap", name: "ICANN RDAP Official Registrar Data", type: "source", identifierType: "domain" },
            { id: "d-whoisxml", name: "WhoisXML API", type: "tool", url: "https://whoisxmlapi.com/" },
            { id: "d-whoxy", name: "Whoxy Reverse WHOIS", type: "tool", url: "https://whoxy.com/" }
          ]
        },
        {
          id: "domain-dns",
          name: "DNS & Passive DNS",
          type: "category",
          children: [
            { id: "d-dns", name: "DNS Records (A, AAAA, MX, NS, TXT, SOA)", type: "source", identifierType: "domain" },
            { id: "d-circl", name: "CIRCL Passive DNS Historical Resolutions", type: "source", identifierType: "domain" },
            { id: "d-dnsdumpster", name: "DNSDumpster", type: "tool", url: "https://dnsdumpster.com/" },
            { id: "d-securitytrails", name: "SecurityTrails Historical DNS", type: "tool", url: "https://securitytrails.com/" }
          ]
        },
        {
          id: "domain-reputation",
          name: "Reputation & Malware Feeds",
          type: "category",
          children: [
            { id: "d-urlhaus", name: "URLhaus (abuse.ch) Malware Check", type: "source", identifierType: "domain" },
            { id: "d-dnsbl", name: "DNSBL Multi-List Spamhaus/SORBS Scoring", type: "source", identifierType: "domain" },
            { id: "d-vt", name: "VirusTotal Domain Intelligence", type: "tool", url: "https://virustotal.com/" }
          ]
        }
      ]
    },
    {
      id: "ip",
      name: "IP & Routing",
      type: "category",
      children: [
        {
          id: "ip-geo",
          name: "Geolocation & Network Info",
          type: "category",
          children: [
            { id: "ip-geoloc", name: "IP Geolocation & ISP Lookup", type: "source", identifierType: "ip" },
            { id: "ip-rdap", name: "RIR RDAP Network Allocations", type: "source", identifierType: "ip" },
            { id: "ip-bgpview", name: "BGPView Prefix, Peers & Upstreams", type: "source", identifierType: "ip" },
            { id: "ip-revdns", name: "PTR Reverse DNS Resolution", type: "source", identifierType: "ip" }
          ]
        },
        {
          id: "ip-services",
          name: "Open Ports & Exposed Services",
          type: "category",
          children: [
            { id: "ip-shodan", name: "Shodan InternetDB (Ports, CVEs, Tags)", type: "source", identifierType: "ip" },
            { id: "ip-censys", name: "Censys Host Search", type: "tool", url: "https://search.censys.io/" },
            { id: "ip-greynoise", name: "GreyNoise Visualizer", type: "tool", url: "https://viz.greynoise.io/" },
            { id: "ip-fofa", name: "FOFA Cyberspace Search", type: "tool", url: "https://en.fofa.info/" }
          ]
        }
      ]
    },
    {
      id: "business",
      name: "Business Records",
      type: "category",
      children: [
        {
          id: "biz-company-profiles",
          name: "Company Profiles & Registries",
          type: "category",
          children: [
            { id: "b-opencorporates", name: "OpenCorporates Global Registry (200M+ Companies)", type: "source", identifierType: "organization" },
            { id: "b-companies-house", name: "Companies House UK Officers & Filing", type: "tool", url: "https://find-and-update.company-information.service.gov.uk/" },
            { id: "b-sec-edgar", name: "SEC EDGAR US Public Filings", type: "tool", url: "https://www.sec.gov/edgar/searchedgar/companysearch" },
            { id: "b-wikidata", name: "Wikidata Entity Graph & Sitelinks", type: "source", identifierType: "organization" },
            { id: "b-crossref", name: "Crossref Works & Publisher Publications", type: "source", identifierType: "organization" },
            { id: "b-crunchbase", name: "Crunchbase Funding & Execs", type: "tool", url: "https://crunchbase.com/" },
            { id: "b-gleif", name: "GLEIF Legal Entity Identifier (LEI)", type: "tool", url: "https://search.gleif.org/" }
          ]
        }
      ]
    },
    {
      id: "crypto",
      name: "Digital Currency & Crypto",
      type: "category",
      children: [
        {
          id: "crypto-explorers",
          name: "Block Explorers & Wallets",
          type: "category",
          children: [
            { id: "c-btc", name: "Bitcoin Address Balances & Transactions", type: "source", identifierType: "wallet" },
            { id: "c-eth", name: "Ethereum Address & Balances (BlockCypher)", type: "source", identifierType: "wallet" },
            { id: "c-etherscan", name: "Etherscan Blockchain Explorer", type: "tool", url: "https://etherscan.io/" },
            { id: "c-blockchain-info", name: "Blockchain.com Explorer", type: "tool", url: "https://www.blockchain.com/explorer" }
          ]
        }
      ]
    },
    {
      id: "archives",
      name: "Archives & History",
      type: "category",
      children: [
        {
          id: "arch-web",
          name: "Web Snapshots",
          type: "category",
          children: [
            { id: "a-wayback", name: "Internet Archive Wayback Machine (CDX & Snapshots)", type: "source", identifierType: "domain" },
            { id: "a-archive-today", name: "archive.today Snapshot Mirror", type: "tool", url: "https://archive.ph/" },
            { id: "a-commoncrawl", name: "Common Crawl Petabyte Web Index", type: "tool", url: "https://commoncrawl.org/" }
          ]
        }
      ]
    },
    {
      id: "threat",
      name: "Threat Intelligence & Hashes",
      type: "category",
      children: [
        {
          id: "th-malware",
          name: "Malware & Hashes",
          type: "category",
          children: [
            { id: "t-bazaar", name: "MalwareBazaar (abuse.ch) 10M+ Sample Signatures", type: "source", identifierType: "hash" },
            { id: "t-urlhaus", name: "URLhaus Malicious Payload Distribution", type: "source", identifierType: "url" },
            { id: "t-virustotal", name: "VirusTotal Multi-Scanner IOC Reports", type: "tool", url: "https://virustotal.com/" },
            { id: "t-alienvault", name: "AlienVault OTX Indicator Pulses", type: "tool", url: "https://otx.alienvault.com/" }
          ]
        }
      ]
    }
  ]
};
