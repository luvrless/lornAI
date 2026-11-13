# Build status and verification

Everything below was built and checked in this environment. "Verified" means a test drives it
against the real server and a real PostgreSQL database; browser items are driven in Chromium
through the production client bundle.

**Test totals:** 92 API/security/subsystem tests + 7 browser end-to-end tests, all passing.
Both TypeScript configs (`tsconfig.json`, `tsconfig.web.json`) typecheck clean.

## Phase 1 — Foundation, accounts, authorization

| Area | State | How it's verified |
|---|---|---|
| Postgres client (SCRAM, TLS, pool, transactions with retry) | Done | used by every test |
| Versioned migrations (checksum, advisory lock) | Done | runs on every test boot |
| Argon2id password hashing (worker threads) | Done | RFC 9106 vectors, cross-checked against Python `cryptography` |
| Register / login / logout, lockout, suspicious-login detection | Done | `phase1-accounts`, browser register + login |
| Usernames 1–12 chars, reserved list, 7-day change cooldown, history | Done | `phase1-accounts` |
| Gapless UIDs (row-locked counter, soft-deleted users keep UID) | Done | `phase1-accounts` |
| Discord OAuth (identify scope) incl. signup completion | Done | fake provider in tests; browser does the full redirect round trip |
| Google OAuth (PKCE) | Built | tested against the local stand-in only |
| Email verify / reset / change, 2FA (TOTP + recovery codes) | Done | `phase1-accounts` |
| Owner by immutable Discord ID only (never stored, never by name) | Done | `phase1-admin`, browser admin test |
| OWNER / ADMIN / STAFF roles + granular permissions + per-staff overrides | Done | `phase1-admin`, `phase6-admin` |
| Admin elevation needs a fresh Discord sign-in | Done | browser test 53 (regular user is refused) |
| Fail-closed admin routes (no permission declared = refused) | Done | `phase1-admin` |
| Immutable, hash-chained audit log (DB triggers block edit/delete/truncate) | Done | `phase1-admin`; browser shows "Chain intact" |
| CSRF (HMAC token + Origin check), JSON-only bodies, rate limits | Done | `phase1-accounts` |

## Phases 2–3 — Profiles, editor, media

| Area | State | How it's verified |
|---|---|---|
| Shared config schema driving validation, editor and renderer | Done | `phase2-3` |
| Draft autosave with revision conflicts, undo/redo | Done | browser test (undo/redo, reload persistence) |
| Publish, version history, rollback, revert | Done | `phase2-3`, browser |
| Drafts never leak to the public page | Done | `phase2-3`, browser (draft text absent after edit) |
| Server-rendered public profiles (title, OG tags, canonical, noindex options, CSP nonce) | Done | browser checks SSR HTML |
| Backgrounds (colour, gradient, image, **video — free**), WebGL effects with CSS fallback, reduced-motion | Done | browser (video background) |
| Click-to-enter screen with exit transition; music starts from that click | Done | browser (card absent before click, exit class, player shows Pause) |
| Text effects, cursor/trails, animations, typography | Done | browser (glitch effect) |
| Links (validated, `javascript:` etc. refused), widgets, extra pages | Done | `phase2-3`, browser |
| Media library on local disk or S3-compatible storage (SigV4) | Done | `phase2-3` (local); SigV4 checked against AWS's published example |
| Upload sniffing by magic bytes, image re-encode (EXIF stripped), thumbnails, ffprobe metadata | Done | `phase2-3`, browser uploads avatar/video/mp3/badge art |
| Asset ownership checks, delete with usage stripping, orphan cleanup, quotas | Done | `phase2-3` |
| Mobile layout (390 px, no horizontal overflow, drawer navigation) | Done | browser mobile test |

## Phase 4 — Badges, events, milestones

| Area | State | How it's verified |
|---|---|---|
| Dynamic badges (create with artwork, assign, revoke, archive; delete only without history) | Done | `phase4`, browser (create in UI → shows on public profile) |
| Availability rules (restricted / purchase-only / automatic / assignable) | Done | `phase4` |
| Custom badges with credits ($2.99 pack = 3 credits) and staff review | Done | `phase4`, `phase5` |
| Events: Christmas 2026, Easter 2027, Summer 2027, one-time; scheduled distribution job; owner override | Done | `phase4` |
| OG badge for first 150 (inside the registration transaction), 1K milestone once | Done | `phase4` |

## Phase 5 — Analytics, monetization

| Area | State | How it's verified |
|---|---|---|
| Views/clicks/plays, bot filtering, daily-salted visitor hash (no raw IPs), dedupe | Done | `phase5`, browser (real visitor counted, headless bot UA ignored) |
| Owner analytics with ranges, CSV export | Done | `phase5` |
| Storefront: Premium $4.99 (off by default, owner switch), badge pack $2.99, Verified $9.99 | Done | `phase5` |
| Stripe checkout, signed webhooks, dedupe, idempotent fulfilment, refunds, cancellation | Done | `phase5` with a local Stripe stand-in |
| Entitlements only granted by verified webhook — never from the browser | Done | `phase5` |
| QR codes (SVG), share page | Done | QR decoded with OpenCV |

## Phase 6 — Admin panel, moderation, support

| Area | State | How it's verified |
|---|---|---|
| 35 admin screens (users, moderation, reports, tickets, badges, events, milestones, monetization, staff, permissions, announcements, flags, storage, integrations, settings, audit, security) | Done | `phase6`; browser opens every screen |
| Account actions with owner and rank protection | Done | `phase6` |
| Reports with evidence and notes, warnings, moderation history | Done | `phase6` |
| Support tickets | Done | `phase6` |

## Phase 7 — End-to-end and hardening (this pass)

Browser tests found and fixed these real bugs:

- Admin dashboard and analytics refetched in an endless loop (the date range used the current millisecond, so the request URL changed every render).
- Every sidebar click did a full page reload (the `Link` component let a caller's `onClick` replace its own).
- The public view counter showed a stale number for the cache lifetime.
- The unread-notification badge refetched on every navigation (now polls every minute and on focus).
- Server-side rendering needed the JSX runtime declared per file to run outside the bundler.
- Added an error boundary so one broken screen shows a recoverable message instead of a blank app.

## Phase 8 — Badge catalogue and admin link

| Area | State | How it's verified |
|---|---|---|
| Admin panel link shown only to the owner and owner-appointed admins (not staff, not users) | Done | `phase8`, browser (absent for a user, present for the owner) |
| All badges: Staff, Helper, Premium, Verified, Donor, OG, Gifter, Server Booster, Winner, Second/Third Place, Image Host, Bug Hunter, Easter 2027, Christmas 2026, The Million | Done | `phase8`, browser catalogue |
| "All badges" list with status (Unlocked / Purchased / Verified / Boosted / Donated) and actions | Done | browser |
| Donations (minimum $10) → Donor badge after the verified webhook | Done | `phase8` |
| Gifting Premium (30 days), Verified or a badge pack → recipient gets it, buyer gets Gifter | Done | `phase8` |
| Sale badges: buy anything during Christmas 2026 / Easter 2027 | Done | `phase8` |
| Server Booster: checked with Discord, removed daily once the boost ends | Done | `phase8` with a Discord stand-in |
| The Million: fires once at 1,000,000 registrations | Done | `phase8` |
| Bug Hunter "Report" opens a bug ticket; Winner/places are given by staff | Done | browser, `phase8` |

## Needs real credentials before launch

These are built and tested against local stand-ins, but have not touched the real service here:

- **Discord OAuth** — create the app, set `DISCORD_CLIENT_ID/SECRET`, redirect `/api/auth/discord/callback`.
- **Google OAuth** — optional; sign-in button shows "not configured" until set.
- **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; then turn payments on in the admin panel.
- **SMTP** — `SMTP_URL`, `MAIL_FROM`. Without it, emails queue and the admin panel says so.
- **S3/R2 storage** — optional; local disk works out of the box.
- **Server Booster** — a bot in your Discord server: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`.
- **Integrations** — Steam, Twitch, YouTube keys. GitHub, Roblox, weather and Discord invites work without keys.

## Known limitations (honest list)

- **Image Host** has a badge but no product: there's no image host yet, so it can't be bought.
- Staff can still open `/admin` by typing the address; only the link is hidden from them.

- **Spotify "now playing"** is not implemented. Spotify embeds work; the integrations page says now-playing isn't available.
- **Custom domains** exist only as a feature flag; there is no domain verification or TLS provisioning.
- **Rate limits are per process.** Running several server instances needs a shared store (Redis or Postgres) for limits.
- **React types are shimmed** (`web/react-shim.d.ts`) because `@types/react` wasn't installable here. Install it and delete the shim when you can.
- **Fonts load from Google Fonts.** Self-host them if you want no third-party requests.
- Creating a media folder uses the browser's prompt dialog rather than a styled modal.
- Tailwind, Next.js, Prisma and Framer Motion weren't installable in this environment, so the stack is plain Node + React + hand-written CSS (see `docs/ARCHITECTURE.md`).
