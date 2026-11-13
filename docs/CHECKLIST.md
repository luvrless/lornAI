# LORN.LOL — Development Checklist

Last updated: 2026-11-13 · Test suite: **28/28 passing** (`npm test`, real PostgreSQL 16)

## Phase 1 — Foundation ✅ complete (backend)

| System | Status | Verified by |
|---|---|---|
| PostgreSQL driver (SCRAM, TLS, pool, transactions, param binding) | Done | driver smoke test, all integration tests |
| Migrations (checksummed, advisory-locked) | Done | applied twice → no-op; boot log |
| Argon2id hashing (worker pool, PHC strings) | Done | RFC 9106 vector + Python `cryptography` cross-check; event-loop test |
| Registration, ToS acceptance | Done | test 1 |
| Username rules (1–12, charset, reserved, case-insensitive, history) | Done | test 3 |
| Gapless atomic UIDs, never reused | Done | concurrency test, deletion test |
| Login (username or email), sessions, logout, revocation | Done | tests 2/7 |
| Lockout after failed logins, equal-timing for unknown users | Done | lockout test |
| CSRF (session-bound token), Origin check, JSON-only bodies | Done | CSRF test + mutation check |
| Rate limiting (per IP / per user, global) | Done (in-memory) | sign-up limit assertion |
| Email verification, password reset, email change | Done (tokens) | tests 5/6 |
| 2FA (TOTP) + single-use recovery codes | Done | 2FA test |
| Suspicious login detection + notification | Done | new-device test |
| Account deletion (soft, PII scrubbed, UID kept) | Done | test 8 |
| Bans / admin locks block sessions and login | Done | ban test |
| Discord OAuth2 (state, browser binding, server-side exchange) | Done | test 51 vs local Discord stand-in |
| Google OAuth2 (PKCE) | Code done, **untested** | needs credentials or a test double |
| Owner via `LORN_OWNER_DISCORD_ID` (computed, not stored) | Done | tests 52 + impersonation test + mutation check |
| Staff authorized by Discord ID before registering, auto-linked | Done | test 54 |
| Roles OWNER/ADMIN/STAFF + granular permission registry | Done | tests 54–56 |
| Owner-only permissions, self-edit and owner protections | Done | test 55 + mutation check |
| Immediate revocation (epoch-invalidated cache) | Done | test 57 |
| Admin elevation requires fresh Discord OAuth | Done | test 52 |
| Settings (protected = owner-only), feature flags, maintenance mode | Done | maintenance test |
| Immutable, hash-chained audit log + search + CSV export | Done | tests 62/63 |
| Fail-closed admin route registration | Done | test 74 |

## Missing infrastructure (needs your credentials / decisions)

| Need | Env vars | Effect until set |
|---|---|---|
| Discord app | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (redirect `APP_URL/api/auth/discord/callback`) | Discord login returns `oauth_not_configured` |
| Google app | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google login returns `oauth_not_configured` |
| SMTP | `SMTP_URL`, `MAIL_FROM` | Emails recorded in `email_outbox` with status `not_configured` |
| S3-compatible storage | (Phase 3) | — |
| Payment provider | (Phase 5) | — |
| Deployment host | — | Not chosen yet |

## Known limitations

- **No SMTP sender yet.** Emails are queued; the delivery worker comes with the job runner (Phase 2/3).
- **Rate limiter is per-process.** Fine for one instance; a Redis store is needed for horizontal scaling.
- **Audit immutability** relies on triggers; in production the app should connect as a role without `ALTER`/`DROP` on `admin_audit_log` (migrations run as owner role).
- **Stack deviation:** Next.js/Prisma/Framer Motion could not be installed (no registry access). See ARCHITECTURE.md §2.

## Remaining phases

- Phase 2 — Landing page, dashboard shell, profile model, draft/publish, social links, public renderer
- Phase 3 — Media storage, uploads, backgrounds, video, card, typography, effects, cursors, animations, click-to-enter
- Phase 4 — Music, pages, widgets, integrations, badges, templates, live editor
- Phase 5 — Analytics, sharing/SEO, entitlements, payments
- Phase 6 — Admin UI: dashboard, users, badges, events, milestones, moderation, storage
- Phase 7 — E2E (Playwright), mobile, performance, security review
