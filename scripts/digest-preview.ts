/**
 * Prints today's digest. With --post it also posts it to ALERT_CHANNEL_ID,
 * whatever SLACK_POSTING_ENABLED says, without claiming the week.
 */
import { WebClient } from "@slack/web-api";
import { loadConfig } from "../src/config.js";
import { buildDigest, digestRange } from "../src/digest.js";
import { WebSlackApi } from "../src/slack/client.js";
import { PgStore, createPool } from "../src/store/pg.js";
import { londonToday } from "../src/time.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl);
try {
  const today = londonToday();
  const events = await new PgStore(pool).listEvents(digestRange(today));
  const text = buildDigest(events, today, {
    calendarUrl: config.calendarUrl,
    howItWorksUrl: config.howItWorksUrl ?? config.guideUrl,
  });
  console.log(text);
  if (process.argv.includes("--post")) {
    if (!config.slackBotToken || !config.alertChannelId) {
      throw new Error("Set SLACK_BOT_TOKEN and ALERT_CHANNEL_ID to post");
    }
    await new WebSlackApi(new WebClient(config.slackBotToken)).postMessage({
      channel: config.alertChannelId,
      text,
    });
    console.log(`\nPosted to ${config.alertChannelId}.`);
  }
} finally {
  await pool.end();
}
