import { londonNow, londonToday, weekStart } from "./time.js";
import { errorFields, log } from "./log.js";
import { monthTitle, shiftMonth } from "./calendar.js";
import { escapeMrkdwn, slackLink, typeText, when } from "./slack/messages.js";
import type { Poster } from "./slack/client.js";
import type { Store } from "./store/store.js";
import type { StoredEvent } from "./types.js";

export const DIGEST_WEEKDAY = 1; // Monday
export const DIGEST_HOUR = 9;

/** True on Monday from 09:00 London time until midnight. */
export function shouldPostDigest(now: Date): boolean {
  const london = londonNow(now);
  return london.weekday === DIGEST_WEEKDAY && london.hour >= DIGEST_HOUR;
}

/** Everything from today on: there are few enough launches to list them all as a heads-up. */
export function digestRange(today: string): { from: string; to: string } {
  return { from: today, to: "9999-12-31" };
}

export interface DigestLinks {
  calendarUrl?: string;
  howItWorksUrl?: string;
  /** The app's base URL. Each launch name links to its page there. */
  appUrl?: string;
}

/**
 * Pure: the digest text. Launches that start this month (or are already underway) get
 * their summary, next month's get one line each, and later ones are only counted.
 */
export function buildDigest(events: StoredEvent[], today: string, links: DigestLinks = {}): string {
  const thisMonth = today.slice(0, 7);
  const nextMonth = shiftMonth(thisMonth, 1);
  const now = events.filter((e) => e.startDate.slice(0, 7) <= thisMonth);
  const next = events.filter((e) => e.startDate.slice(0, 7) === nextMonth);
  const later = events.length - now.length - next.length;

  const lines = ["*🚀 Launches and pricing changes*"];
  if (events.length === 0) {
    lines.push("Nothing upcoming on the launch calendar.");
  } else {
    lines.push("", `*This month (${monthName(thisMonth)})*`);
    lines.push(...(now.length ? now.map((e) => item(e, links, true)) : ["Nothing planned."]));
    lines.push("", `*Next month (${monthName(nextMonth)})*`);
    lines.push(...(next.length ? next.map((e) => item(e, links, false)) : ["Nothing planned."]));
  }

  const footer = [
    ...(later > 0 ? [`${later} more after ${monthName(nextMonth)} on the launch calendar.`] : []),
    "Tentative dates can still move.",
  ];
  const footerLinks = [
    ...(links.calendarUrl ? [slackLink(links.calendarUrl, "Open the launch calendar")] : []),
    ...(links.howItWorksUrl ? [slackLink(links.howItWorksUrl, "How it works")] : []),
  ];
  lines.push("", footer.join(" "));
  if (footerLinks.length) lines.push(footerLinks.join(" · "));
  return lines.join("\n");
}

/** "November" */
function monthName(month: string): string {
  return monthTitle(month).split(" ")[0] ?? month;
}

function item(event: StoredEvent, links: DigestLinks, withSummary: boolean): string {
  const name = links.appUrl
    ? slackLink(`${links.appUrl}/launches/${encodeURIComponent(event.eventId)}`, event.name)
    : escapeMrkdwn(event.name);
  const summary = withSummary ? summarySuffix(event) : "";
  return `• ${typeText(event)} · *${name}*, ${when(event)}${summary}`;
}

export interface DigestDeps {
  store: Store;
  poster: Poster;
  channelId: string | undefined;
  calendarUrl?: string;
  guideUrl?: string;
  howItWorksUrl?: string;
  appUrl?: string;
}

export type DigestResult =
  "not_time" | "not_configured" | "posting_disabled" | "already_posted" | "posted" | "failed";

/** Claims the week before posting, so a restart or a second replica can't post it twice. */
export async function runDigestTick(
  deps: DigestDeps,
  now: Date = new Date(),
): Promise<DigestResult> {
  if (!shouldPostDigest(now)) return "not_time";
  if (!deps.channelId) return "not_configured";
  // Check before claiming, so the digest still goes out once posting is turned on.
  if (!deps.poster.enabled) return "posting_disabled";

  const today = londonToday(now);
  const week = weekStart(today);
  if (!(await deps.store.claimDigest(week, deps.channelId))) return "already_posted";

  try {
    const events = await deps.store.listEvents(digestRange(today));
    const { ts } = await deps.poster.post(
      deps.channelId,
      buildDigest(events, today, {
        calendarUrl: deps.calendarUrl,
        howItWorksUrl: deps.howItWorksUrl ?? deps.guideUrl,
        appUrl: deps.appUrl,
      }),
    );
    if (ts) await deps.store.setDigestMessageTs(week, ts);
    log.info("digest posted", { week, events: events.length });
    return "posted";
  } catch (err) {
    log.error("digest failed, releasing the week", { week, ...errorFields(err) });
    await deps.store.releaseDigest(week).catch(() => undefined);
    return "failed";
  }
}

function summarySuffix(event: StoredEvent): string {
  if (!event.summary) return "";
  const sentence = /[.!?…]$/.test(event.summary) ? event.summary : `${event.summary}.`;
  return `. ${escapeMrkdwn(sentence)}`;
}
