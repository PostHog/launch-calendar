/** Runs one sync, alert, reminder and digest pass against the real calendar, then exits. */
import { loadConfig } from "../src/config.js";
import { createRunnerDeps } from "../src/deps.js";
import { runTick } from "../src/runner.js";
import { PgStore, createPool } from "../src/store/pg.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl);
try {
  const result = await runTick(createRunnerDeps(config, new PgStore(pool)));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
