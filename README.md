# LORN.LOL

Social identity & profile platform. See `docs/ARCHITECTURE.md` for the design and
`docs/CHECKLIST.md` for what is built, how it was verified, and what still needs real credentials.

## Run locally

Requirements: Node 22+, PostgreSQL 14+ (with `citext`), ffmpeg/ffprobe for video and audio metadata.

```sh
npm install                      # react, react-dom, react-icons, zod, sharp, esbuild, tsx, playwright
cp .env.example .env             # fill DATABASE_URL at minimum
export $(grep -v '^#' .env | xargs)
npx tsx scripts/build.ts         # builds dist/web (client) and dist/server.js
node dist/server.js              # migrates, starts the job worker, listens on $PORT
```

For development, `npx tsx server/main.ts` runs the server from source (build the client first).

## Tests

Tests run against a real database that is **wiped** on every run.

```sh
export TEST_DATABASE_URL=postgres://lorn:pw@127.0.0.1:5432/lorn_test
# API, security and subsystem tests (84)
npx tsx --test --test-concurrency=1 $(ls tests/*.test.ts | grep -v e2e)
# Browser end-to-end tests (Chromium; needs a client build first)
npx tsx scripts/build.ts && npx tsx --test tests/e2e.test.ts
```

The test harness stands in for Discord OAuth, Stripe, SMTP and storage locally, so no
external accounts are needed to run them.

## Admin access

1. Set `LORN_OWNER_DISCORD_ID` and the Discord OAuth credentials.
2. Open `/admin` and continue with Discord. The owner is recognised by Discord ID only;
   staff are added in the admin panel by Discord ID.


## Email (Resend)

Account emails (verification, password reset, email change, sign-in alerts) are queued in `email_outbox` and sent through the Resend API.

- `RESEND_API_KEY` — your Resend API key. When set, Resend is used.
- `MAIL_FROM` — sender on a domain verified in Resend, e.g. `LORN.LOL <no-reply@lorn.lol>`.
- `MAIL_REPLY_TO` — optional.
- `SMTP_URL` — fallback transport if no API key is set.

Each message carries an idempotency key, so retries never send twice. Without a provider, emails are recorded as `not_configured` and the UI says so.

## Starter profiles

Every account is public from sign-up as a plain card (display name, @username, join date, views, UID). The private draft replaces it only when the owner publishes; unpublishing returns to the starter card.
