/**
 * Application container: config, database, shared services. Modules take an
 * `App` so tests can build an isolated instance against the test database.
 */
import { Pool, configFromUrl, Queryable } from "./db/pg.ts";
import { Config } from "./lib/config.ts";
import { MemoryRateLimiter, RateLimitStore } from "./lib/ratelimit.ts";
import { StorageDriver, storageFromEnv } from "./modules/media/storage.ts";

export interface Logger {
  info(msg: string, data?: object): void;
  warn(msg: string, data?: object): void;
  error(msg: string, data?: object): void;
}

export interface App {
  cfg: Config;
  db: Pool;
  limiter: RateLimitStore;
  storage: StorageDriver;
  storageStatus: string;
  log: Logger;
  /** Injected for tests; defaults to global fetch. */
  fetch: typeof fetch;
  now(): Date;
}

export function jsonLogger(quiet = false): Logger {
  const w = (level: string) => (msg: string, data?: object) => {
    if (quiet && level !== "error") return;
    process.stdout.write(JSON.stringify({ t: new Date().toISOString(), level, msg, ...data }) + "\n");
  };
  return { info: w("info"), warn: w("warn"), error: w("error") };
}

export function createApp(cfg: Config, overrides: Partial<App> = {}): App {
  const st = storageFromEnv(cfg.appUrl);
  return {
    storage: st.driver,
    storageStatus: st.status,
    cfg,
    db: new Pool(configFromUrl(cfg.databaseUrl, { max: 20, statementTimeoutMs: 15_000 })),
    limiter: new MemoryRateLimiter(),
    log: jsonLogger(cfg.env === "test"),
    fetch: globalThis.fetch.bind(globalThis),
    now: () => new Date(),
    ...overrides,
  };
}

export type { Queryable };
