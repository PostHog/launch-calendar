import { WebClient } from "@slack/web-api";
import type { Config } from "./config.js";
import { GoogleCalendarSource, createCalendarApi } from "./google/calendar.js";
import { log } from "./log.js";
import type { RunnerDeps } from "./runner.js";
import { WebSlackApi, createPoster } from "./slack/client.js";
import type { Store } from "./store/store.js";

/** Wires the real Google and Slack clients from config, warning about whatever is missing. */
export function createRunnerDeps(config: Config, store: Store): RunnerDeps {
  if (!config.google) log.warn("Google credentials missing, sync is off");
  if (!config.calendarId) log.warn("LAUNCH_CALENDAR_ID missing, sync is off");
  if (!config.slackBotToken) log.warn("SLACK_BOT_TOKEN missing, Slack is off");
  if (!config.alertChannelId) log.warn("ALERT_CHANNEL_ID missing, nothing is posted");
  if (!config.slackPostingEnabled)
    log.warn("SLACK_POSTING_ENABLED is false, Slack posts are logged instead");

  const source = config.google
    ? new GoogleCalendarSource(createCalendarApi(config.google))
    : undefined;
  const slack = config.slackBotToken
    ? new WebSlackApi(new WebClient(config.slackBotToken))
    : undefined;
  return {
    store,
    source,
    poster: createPoster(slack, config.slackPostingEnabled),
    calendarId: config.calendarId,
    channelId: config.alertChannelId,
    calendarUrl: config.calendarUrl,
    guideUrl: config.guideUrl,
    howItWorksUrl: config.howItWorksUrl,
  };
}
