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
