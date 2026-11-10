import type { calendar_v3 } from "@googleapis/calendar";
import { DateTime } from "luxon";
import { LONDON, addDays } from "./time.js";
import type { LaunchEvent, LaunchLink, LaunchStatus, LaunchType } from "./types.js";

export type ParseResult =
  | { kind: "event"; event: LaunchEvent }
  | { kind: "removed"; eventId: string }
  | { kind: "skipped"; eventId: string; reason: string };

const STATUS_PREFIX =
  /^\s*(?:\[\s*(tentative|tbc|confirmed)\s*\]|\(\s*(tentative|tbc|confirmed)\s*\)|(tentative|tbc|confirmed)\s*[:\-–])\s*/i;

const TYPE_WORDS: Record<string, LaunchType> = {
  "public beta": "public_beta",
  beta: "public_beta",
  ga: "ga",
  "general availability": "ga",
  pricing: "pricing",
  billing: "billing",
  deprecation: "deprecation",
  sunset: "deprecation",
  "marketing launch": "marketing_launch",
  other: "other",
  launch: "other",
};
// "GA + Pricing:" marks a release that also starts charging. "&" and "and" work too.
const TYPE_PREFIX = new RegExp(
  `^\\s*(${Object.keys(TYPE_WORDS).join("|")})(\\s*(?:\\+|&|and)\\s*pricing)?\\s*[:\\-–]\\s*`,
  "i",
);

const MAX_LINKS = 4;

export interface ParsedTitle {
  name: string;
  /** Status from the title, or undefined when the title has no status prefix. */
  status: LaunchStatus | undefined;
  type: LaunchType;
  /** True for "GA + Pricing:" and the like. Always false for the pricing type itself. */
  includesPricing: boolean;
}

/**
 * Reads the title convention "[Tentative] Public beta: Product name".
 * Both prefixes are optional and can come in either order.
 */
export function parseTitle(raw: string): ParsedTitle {
  let rest = raw.trim();
  let status: LaunchStatus | undefined;
  let type: LaunchType | undefined;
  let withPricing = false;

  for (let i = 0; i < 2; i++) {
    const s = STATUS_PREFIX.exec(rest);
    if (s && !status) {
      const word = (s[1] ?? s[2] ?? s[3] ?? "").toLowerCase();
      status = word === "confirmed" ? "confirmed" : "tentative";
      rest = rest.slice(s[0].length);
      continue;
    }
    const t = TYPE_PREFIX.exec(rest);
    if (t && !type) {
      type = TYPE_WORDS[(t[1] ?? "").toLowerCase()];
      withPricing = Boolean(t[2]);
      rest = rest.slice(t[0].length);
      continue;
    }
    break;
  }

  const finalType = type ?? "other";
  return {
    name: rest.trim() || raw.trim() || "Untitled",
    status,
    type: finalType,
    includesPricing: withPricing && finalType !== "pricing",
  };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Google Calendar stores descriptions as light HTML. Turns it into plain lines. */
export function descriptionLines(description: string | null | undefined): string[] {
  if (!description) return [];
  const text = description
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>.*?<\/a>/gis, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/;

const SLACK_CHANNEL_LINE = /^slack(?:\s+channel)?\s*:\s*(.+)$/i;

/** Known labels read the same in Slack however they were typed in the description. */
function linkLabel(raw: string): string {
  if (/^rfc$/i.test(raw)) return "RFC";
  if (/^marketing(?:\s+launch)?(?:\s+issue)?$/i.test(raw)) return "Marketing launch issue";
  return raw;
}

/** Lines like "RFC: https://…" become labelled links. The Slack channel line is read separately. */
export function parseLinks(lines: string[]): LaunchLink[] {
  const links: LaunchLink[] = [];
  for (const line of lines) {
    if (SLACK_CHANNEL_LINE.test(line)) continue;
    const match = /^([A-Za-z][\w &/-]{0,30}?)\s*:\s*(https?:\/\/\S+)/.exec(line);
    if (!match) continue;
    const url = URL_PATTERN.exec(match[2] ?? "")?.[0];
    if (url) links.push({ label: linkLabel(match[1]?.trim() ?? "Link"), url });
    if (links.length === MAX_LINKS) break;
  }
  return links;
}

/**
 * The launch's Slack channel, from a "Slack channel:" line. A channel link
 * (…/archives/C0123ABC) gives its ID, which Slack shows as a clickable channel.
 * A plain "#name" is kept as text.
 */
export function parseSlackChannel(lines: string[]): string | null {
  for (const line of lines) {
    const value = SLACK_CHANNEL_LINE.exec(line)?.[1]?.trim();
    if (!value) continue;
    const id =
      /\/archives\/([CG][A-Z0-9]{6,})/.exec(value)?.[1] ?? /^<#([CG][A-Z0-9]{6,})/.exec(value)?.[1];
    if (id) return id;
    const name = /^#?([a-z0-9][a-z0-9_-]{0,79})$/.exec(value.toLowerCase())?.[1];
    if (name) return `#${name}`;
  }
  return null;
}

/** A line like "Owner: someone@posthog.com" names the owner when it isn't the event's creator. */
export function parseOwner(lines: string[]): string | null {
  for (const line of lines) {
    const match = /^owner\s*:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i.exec(line);
    if (match?.[1]) return match[1].toLowerCase();
  }
  return null;
}

function londonDate(dateTime: string, endOfRange: boolean): string {
  let dt = DateTime.fromISO(dateTime, { setZone: true }).setZone(LONDON);
  // An event that ends exactly at midnight belongs to the day before.
  if (endOfRange && dt.hour === 0 && dt.minute === 0) dt = dt.minus({ minutes: 1 });
  return dt.toISODate() ?? "";
}

function eventDates(event: calendar_v3.Schema$Event): { start: string; end: string } | null {
  if (event.start?.date) {
    const start = event.start.date;
    // All-day end dates are exclusive.
    const end = event.end?.date ? addDays(event.end.date, -1) : start;
    return { start, end: end < start ? start : end };
  }
  if (event.start?.dateTime) {
    const start = londonDate(event.start.dateTime, false);
    const end = event.end?.dateTime ? londonDate(event.end.dateTime, true) : start;
    return { start, end: end < start ? start : end };
  }
  return null;
}

export function parseEvent(raw: calendar_v3.Schema$Event, calendarId: string): ParseResult {
  const eventId = raw.id ?? "";
  if (raw.status === "cancelled") return { kind: "removed", eventId };
  if (raw.recurrence?.length || raw.recurringEventId) {
    return { kind: "skipped", eventId, reason: "recurring events are not launches" };
  }
  // Anyone can invite the calendar to an event they organise. Only events created on the
  // calendar itself are launches, so an outsider can't make the bot post their text and links.
  if (!(raw.organizer?.self === true || raw.organizer?.email === calendarId)) {
    return { kind: "skipped", eventId, reason: "organised outside the launch calendar" };
  }
  const dates = eventDates(raw);
  if (!dates) return { kind: "skipped", eventId, reason: "event has no start date" };

  const title = parseTitle(raw.summary ?? "");
  const lines = descriptionLines(raw.description);
  // No status prefix: a single day reads as a fixed date, a longer span as a window.
  const status = title.status ?? (dates.start === dates.end ? "confirmed" : "tentative");

  return {
    kind: "event",
    event: {
      calendarId,
      eventId,
      name: title.name,
      status,
      type: title.type,
      includesPricing: title.includesPricing,
      startDate: dates.start,
      endDate: dates.end,
      ownerEmail: parseOwner(lines) ?? raw.creator?.email?.toLowerCase() ?? null,
      htmlLink: raw.htmlLink ?? null,
      links: parseLinks(lines),
      slackChannel: parseSlackChannel(lines),
    },
  };
}
