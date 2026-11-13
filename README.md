# LORN.LOL

Social identity & profile platform. See `docs/ARCHITECTURE.md` and `docs/CHECKLIST.md`.

## Run locally

Requirements: Node 22+, PostgreSQL 14+ (with `citext`).

```sh
cp .env.example .env            # fill DATABASE_URL at minimum
export $(grep -v '^#' .env | xargs)
npx tsx server/main.ts          # migrates, then listens on $PORT
```

## Tests

Tests run against a real database that is **wiped** on every run:

```sh
TEST_DATABASE_URL=postgres://lorn:pw@127.0.0.1:5432/lorn_test npx tsx --test --test-concurrency=1 tests/*.test.ts
```

## Admin access

1. Set `LORN_OWNER_DISCORD_ID` and Discord OAuth credentials.
2. Visit `/api/auth/discord/start?intent=admin`. The owner is recognised by Discord ID
   only; staff are added in the admin panel by Discord ID.
