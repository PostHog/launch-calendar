import { z } from "zod";
import type { GoogleCredentials } from "./google/calendar.js";

const blankToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optional = z.preprocess(blankToUndefined, z.string().optional());
const flag = (fallback: "true" | "false") =>
  z
    .preprocess(blankToUndefined, z.enum(["true", "false"]).default(fallback))
    .transform((v) => v === "true");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),

  APP_BASE_URL: optional,
  HOW_IT_WORKS_URL: optional,
  LAUNCH_CALENDAR_ID: optional,
  CALENDAR_URL: optional,

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GOOGLE_REFRESH_TOKEN: optional,
  GOOGLE_SERVICE_ACCOUNT_JSON: optional,
  GOOGLE_IMPERSONATE_USER: optional,

  SLACK_BOT_TOKEN: optional,
  ALERT_CHANNEL_ID: optional,
  MAINTAINER_EMAIL: optional,
  SLACK_POSTING_ENABLED: flag("false"),

  SYNC_INTERVAL_MINUTES: z.coerce.number().positive().default(5),
});

export interface Config {
  databaseUrl: string;
  port: number;
  calendarId?: string;
  calendarUrl?: string;
  /** The app's /guide page. Only set when APP_BASE_URL is, since Slack can't open localhost. */
  guideUrl?: string;
  /** The digest's "How it works" link. Falls back to guideUrl. */
  howItWorksUrl?: string;
  google?: GoogleCredentials;
  slackBotToken?: string;
  alertChannelId?: string;
  /** Gets a DM when syncs keep failing. */
  maintainerEmail?: string;
  slackPostingEnabled: boolean;
  syncIntervalMs: number;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const env = envSchema.parse(source);
  let google: GoogleCredentials | undefined;
  // Delegation wins when both are set, so switching to option B is just adding two secrets.
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON && env.GOOGLE_IMPERSONATE_USER) {
    google = {
      kind: "delegated",
      serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON,
      impersonate: env.GOOGLE_IMPERSONATE_USER,
    };
  } else if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN) {
    google = {
      kind: "oauth",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      refreshToken: env.GOOGLE_REFRESH_TOKEN,
    };
  }
  return {
    databaseUrl: env.DATABASE_URL,
    port: env.PORT,
    calendarId: env.LAUNCH_CALENDAR_ID,
    calendarUrl: env.CALENDAR_URL,
    guideUrl: env.APP_BASE_URL ? `${env.APP_BASE_URL.replace(/\/+$/, "")}/guide` : undefined,
    howItWorksUrl: env.HOW_IT_WORKS_URL,
    google,
    slackBotToken: env.SLACK_BOT_TOKEN,
    alertChannelId: env.ALERT_CHANNEL_ID,
    maintainerEmail: env.MAINTAINER_EMAIL,
    slackPostingEnabled: env.SLACK_POSTING_ENABLED,
    syncIntervalMs: env.SYNC_INTERVAL_MINUTES * 60_000,
  };
}
