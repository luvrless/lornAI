# LORN.LOL — Architecture

## 1. Environment findings (inspected 2026-11-13)

| Resource | Available | Notes |
|---|---|---|
| Node.js | 22.23 | No `crypto.argon2` (added in Node 24) |
| Package registry | **No** | npm/pip installs are refused by the sandbox network policy |
| PostgreSQL | 16 (server + client binaries) | Run locally via `initdb`/`pg_ctl` |
| Redis | 7.0 server | No client library installed |
| Object storage | None | No S3/MinIO reachable |
| Docker | Binary only, no daemon | |
| Pre-installed JS | react 19, react-dom 19, tailwindcss 4.3, esbuild 0.28, zod, sharp, tsx, typescript 6, react-icons, playwright, ws, nanoid | |
| Media tools | ffmpeg, sharp | Thumbnails, video/audio metadata |
| Deployment platform | Not identified | Build targets a plain Node + PostgreSQL host (any VPS, Fly, Railway, Render) |

## 2. Stack decision

The spec prefers Next.js + Prisma. Neither can be installed here, and the spec
also says *"Choose technologies based on actual deployment compatibility"* and
*"Do not claim that something is complete without testing it."* An untestable
Next/Prisma codebase would violate the second rule, so the platform is built on
what can be run and verified:

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node 22, TypeScript (run with `tsx`, bundled with `esbuild` for prod) | Available, typed |
| HTTP | Own small router on `node:http` (`server/lib/http.ts`) | Zero deps, full control of cookies/CSRF/headers |
| Database | PostgreSQL 16 | As specified |
| DB driver | Own wire-protocol client (`server/db/pg.ts`): SCRAM-SHA-256, TLS, extended query protocol (parameterised — no string-built SQL), pooling, transactions | No `pg` package available |
| Migrations | Plain versioned SQL files + runner with checksum locking | Reviewable, no ORM magic |
| Validation | zod | Available |
| Passwords | Argon2id, own implementation (`server/lib/argon2.ts`), verified against the `cryptography` reference implementation | No argon2 package available |
| Frontend | React 19 SPA + SSR-rendered public profiles, bundled by esbuild, Tailwind 4 | Available; Framer Motion replaced by a small Web Animations API layer honouring `prefers-reduced-motion` |
| Icons | react-icons (Lucide set) | Professional SVG icons, no emoji |
| Storage | `StorageDriver` interface with **S3 (SigV4) driver** and **local-disk driver** | S3 cannot be reached here; driver is selected by env vars |
| Jobs | Postgres-backed job queue (`SELECT … FOR UPDATE SKIP LOCKED`) | Durable: survives restarts, which the event-distribution spec requires |
| Rate limiting | Postgres/in-memory token buckets behind an interface | Redis adapter can be dropped in later |
| Tests | `node:test` via tsx, against a real Postgres database | |

If package installs are enabled later, the frontend could move to Next.js; the
backend modules are framework-independent services and would not change.

## 3. Layout

```
server/
  db/pg.ts            Postgres wire client + pool
  db/migrate.ts       migration runner
  db/migrations/*.sql
  lib/                http, cookies, csrf, ratelimit, argon2, crypto, mail, config, errors
  modules/<name>/     service.ts (business logic, DB) + routes.ts (HTTP)
  main.ts             composition root
web/                  React app (dashboard, editor, admin) + shared profile renderer
tests/                integration tests (real DB)
docs/                 this file, CHECKLIST.md, API.md
```

Each module exposes **services** (pure business logic taking a DB handle) and
**routes** (HTTP adapters). Admin routes live under `/api/admin/*` and every one
declares the permission it needs; the router refuses to register an admin
route without one.

## 4. Cross-cutting rules

- **Sessions:** opaque 256-bit tokens in an `HttpOnly; Secure; SameSite=Lax`
  cookie; only the SHA-256 of the token is stored. Revocation = delete row.
- **CSRF:** every non-GET API request must carry `X-CSRF-Token` equal to an
  HMAC of the session ID (double-submit, bound to the session).
- **Authorization:** resolved per request from the DB (with a short cache
  invalidated by a `permission_epoch` counter that bumps on every staff or
  permission change).
- **Owner:** `LORN_OWNER_DISCORD_ID` (env) is compared to the Discord ID
  returned by Discord's `/users/@me` after a server-side code exchange. The
  owner role is computed, never stored, so no DB edit can remove it.
- **Audit:** `admin_audit_log` is append-only; a trigger rejects `UPDATE`/
  `DELETE`, and the app's DB role has no privilege to drop it.
- **UIDs:** a dedicated Postgres sequence (`NO CYCLE`), assigned in the same
  transaction as the user insert; users are soft-deleted so UIDs are never freed.
- **Usernames:** 1–12 chars `[a-z0-9_.]`, stored lower-cased in a unique column
  (`username_lc`), reserved list in DB, full change history.
- **External APIs:** if credentials are missing, the integration reports
  `not_configured` — never fabricated data.
