# lorn.lol

A free, modular **OSINT intelligence platform** for lawful, defensive digital investigations.
One unified engine auto-detects an identifier and fans out across 150+ registered sources — with
**live per-source progress** and **zero fabricated results**.

> Built for authorized OSINT and security research only. Not a background-check or
> employment-screening service. Queries public and consented sources exclusively.

## What actually works right now (no API keys needed)

The engine ships with **16 live, keyless adapters** that make real network/DNS calls:

| Module | Sources |
| --- | --- |
| Email | syntax/structure, provider & disposable detection, SPF/DMARC, MX provider |
| Domain | DNS records, RDAP/WHOIS, Certificate Transparency (crt.sh), TLS cert, HTTP headers & tech fingerprint |
| IP | RDAP network, reverse DNS, geolocation & ASN (ipwho.is), DNSBL reputation |
| Phone | offline E.164 validation, country, calling code, line type |
| Username | existence checks across 30+ platforms (GitHub, Reddit, HN, Docker Hub, …) via official APIs & public pages |
| Crypto | Bitcoin address on-chain activity (Blockstream) |
| Breach | password exposure via HIBP **k-anonymity** (privacy-preserving) |

**100+ additional sources** (VirusTotal, Shodan, HIBP breaches, SecurityTrails, AbuseIPDB, …) are
registered with honest status (`requires_key` / `public_web` / `planned`) and run the moment you
supply their credentials. Nothing returns fake data.

## Features

- Unified investigation console with input auto-detection and **SSE live progress**
- Per-source execution states (waiting / running / completed / no-results / rate-limited / needs-key / failed)
- Cases, notes, saved results, history, JSON/CSV export
- Evidence graph (relationships drawn only from observed findings)
- Source manager with search & filters
- Email/password auth (scrypt), sessions, roles (user/moderator/admin)
- Admin panel: user management, audit log, system stats
- Versioned REST API (`/api/v1`) with scoped API keys, plus a TypeScript SDK and CLI
- Account deletion & data minimization (GDPR-style)

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000  → Create account (first user is admin)
```

No database or keys required. Data persists to a local JSON store under `./data`.

### Production

```bash
npm run build && npm start
# or
docker compose up --build
```

Set `LORN_SECRET` to a long random string in production (otherwise one is generated to `data/.secret`).
Add optional provider keys from `.env.example` to activate key-ready sources.

## API

```bash
curl -X POST http://localhost:3000/api/v1/investigations \
  -H "Authorization: Bearer lorn_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"input":"example.com","save":true}'
```

SDK: `sdk/index.ts` · CLI: `cli/lorn.mjs` (`LORN_API_KEY=... node cli/lorn.mjs investigate example.com`).

## Architecture

- **Next.js 14 (App Router) + TypeScript + Tailwind** — one full-stack app
- All source integrations run **server-side**; credentials never reach the browser
- Adapter contract (`lib/types.ts` → `Adapter`) with a concurrent streaming runner (`lib/sources/runner.ts`)
- SSRF-guarded outbound requests; sensitive findings redacted by default
- Pluggable datastore (`lib/db.ts`) — JSON today, swap for Postgres for scale

## Responsible use

No stolen-credential retrieval, no password cracking, no private-account access, no facial
recognition, no covert tracking, no automated exploitation. Vulnerability signals are informational
and non-invasive.

## Not yet implemented (honest status)

- The LORN AI agent (explicitly excluded from this build)
- Keyed providers require their credentials to activate
- Email verification is auto-approved in self-hosted mode (wire SMTP for production)
