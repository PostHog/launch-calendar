import { formatDay, londonNow, londonToday, weekStart } from "./time.js";
import { errorFields, log } from "./log.js";
import { channelText, launchLabel, slackLink, when } from "./slack/messages.js";
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

/** Pure: the digest text for every launch that ends today or later. */
export function buildDigest(
  events: StoredEvent[],
  today: string,
  links: { calendarUrl?: string; howItWorksUrl?: string } = {},
): string {
  const lines = ["*🚀 Upcoming launches and pricing changes*"];
  if (events.length === 0) {
    lines.push("Nothing upcoming on the launch calendar.");
  } else {
    const byWeek = new Map<string, StoredEvent[]>();
    for (const event of events) {
      // Launches already underway show under this week.
      const week = weekStart(event.startDate < today ? today : event.startDate);
      byWeek.set(week, [...(byWeek.get(week) ?? []), event]);
    }
    for (const week of [...byWeek.keys()].sort()) {
      lines.push("", `*Week of ${formatDay(week)}*`);
      for (const event of byWeek.get(week) ?? [])
        lines.push(`• ${launchLabel(event)}, ${when(event)}${channelSuffix(event)}`);
    }
  }
  const footer = ["Tentative dates can still move."];
  const footerLinks = [
    ...(links.calendarUrl ? [slackLink(links.calendarUrl, "Open the launch calendar")] : []),
    ...(links.howItWorksUrl ? [slackLink(links.howItWorksUrl, "How it works")] : []),
  ];
  if (footerLinks.length) footer.push(footerLinks.join(" · "));
  lines.push("", footer.join(" "));
  return lines.join("\n");
}

export interface DigestDeps {
  store: Store;
  poster: Poster;
  channelId: string | undefined;
  calendarUrl?: string;
  guideUrl?: string;
  howItWorksUrl?: string;
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

function channelSuffix(event: StoredEvent): string {
  const channel = channelText(event.slackChannel);
  return channel ? ` · ${channel}` : "";
}
