export const LAUNCH_TYPES = [
  "public_beta",
  "ga",
  "pricing",
  "billing",
  "deprecation",
  "marketing_launch",
  "other",
] as const;
export type LaunchType = (typeof LAUNCH_TYPES)[number];

export const LAUNCH_STATUSES = ["tentative", "confirmed"] as const;
export type LaunchStatus = (typeof LAUNCH_STATUSES)[number];

export interface LaunchLink {
  label: string;
  url: string;
}

/** One launch on the calendar, read from a Google Calendar event. */
export interface LaunchEvent {
  calendarId: string;
  eventId: string;
  /** The title without the status and type prefixes. */
  name: string;
  status: LaunchStatus;
  type: LaunchType;
  /** A release that also starts charging, written "GA + Pricing:". */
  includesPricing: boolean;
  /** First day, YYYY-MM-DD in London time. */
  startDate: string;
  /** Last day, inclusive, YYYY-MM-DD in London time. */
  endDate: string;
  ownerEmail: string | null;
  htmlLink: string | null;
  links: LaunchLink[];
  /** The launch's Slack channel: a channel ID like "C0123ABC", or "#name" when only the name was given. */
  slackChannel: string | null;
}

export interface StoredEvent extends LaunchEvent {
  /** The start date the owner was last reminded about, so a moved launch gets a new reminder. */
  remindedForStart: string | null;
}

export type Change =
  | { kind: "added"; event: LaunchEvent }
  | { kind: "confirmed"; event: LaunchEvent; before: LaunchEvent }
  | { kind: "unconfirmed"; event: LaunchEvent; before: LaunchEvent }
  | { kind: "moved"; event: LaunchEvent; before: LaunchEvent }
  | { kind: "removed"; before: LaunchEvent };
