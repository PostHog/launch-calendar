import { loadConfig } from "./config.js";
import { createRunnerDeps } from "./deps.js";
import { errorFields, log } from "./log.js";
import { startRunner } from "./runner.js";
import { PgStore, createPool } from "./store/pg.js";
import { createApp } from "./web.js";

function main(): void {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  pool.on("error", (err) => log.error("postgres pool error", errorFields(err)));
  const store = new PgStore(pool);

  const app = createApp({ store, calendarUrl: config.calendarUrl });
  const server = app.listen(config.port, "0.0.0.0", () => {
    log.info("server listening", { port: config.port });
  });

  const stopRunner = startRunner(createRunnerDeps(config, store), config.syncIntervalMs);

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info("shutting down", { signal });
    stopRunner();
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
