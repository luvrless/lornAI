import { loadConfig } from "./lib/config.ts";
import { createApp } from "./app.ts";
import { migrate } from "./db/migrate.ts";
import { configFromUrl } from "./db/pg.ts";
import { buildServer } from "./server.ts";
import { closeHashPool } from "./lib/password.ts";

const cfg = loadConfig();
const app = createApp(cfg);
await migrate(configFromUrl(cfg.databaseUrl), (m) => app.log.info(m));
const { server } = await buildServer(app);
server.listen(cfg.port, () => app.log.info("listening", { port: cfg.port, url: cfg.appUrl }));

const shutdown = async () => {
  app.log.info("shutting down");
  server.close();
  await app.db.end();
  await closeHashPool();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
