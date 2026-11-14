-- Periodic maintenance ticks claim their run here, so they fire once per interval
-- across all server instances (and serverless cold starts), not once per process.
CREATE TABLE tick_runs (
  name    text PRIMARY KEY,
  last_at timestamptz NOT NULL
);
