import { errorFields, log } from "./log.js";
import { changesPricing, ownerText, reminderMessage } from "./slack/messages.js";
import type { Poster } from "./slack/client.js";
import type { Store } from "./store/store.js";
import { addDays, daysBetween, londonNow, londonToday } from "./time.js";
import type { StoredEvent } from "./types.js";

/** Reminders go out on weekdays from 09:00 London time, like the digest, not at midnight. */
export const REMINDER_HOUR = 9;

export function isReminderTime(now: Date): boolean {
  const london = londonNow(now);
  return london.weekday <= 5 && london.hour >= REMINDER_HOUR;
}

/** Pricing changes need 10 business days' notice for sales, so their owners hear two weeks out. */
export function reminderLeadDays(event: StoredEvent): number {
  return changesPricing(event) ? 14 : 7;
}

export function dueReminders(events: StoredEvent[], today: string): StoredEvent[] {
  return events.filter(
    (e) =>
      e.status === "tentative" &&
      e.endDate >= today &&
      e.remindedForStart !== e.startDate &&
      daysBetween(today, e.startDate) <= reminderLeadDays(e),
  );
}

/**
 * Posts a reminder in the alert channel for each tentative launch that is close,
 * mentioning its owner. Launch dates are public at PostHog, so this isn't a DM.
 * A reminder that falls due at night or on a weekend waits for the next weekday morning.
 */
export async function runReminders(
  deps: { store: Store; poster: Poster; channelId: string | undefined; guideUrl?: string },
  now: Date,
): Promise<number> {
  if (!deps.poster.enabled || !deps.channelId || !isReminderTime(now)) return 0;
  const today = londonToday(now);
  const events = await deps.store.listEvents({ from: today, to: addDays(today, 14) });
  let sent = 0;
  for (const event of dueReminders(events, today)) {
    try {
      const userId = event.ownerEmail ? await deps.poster.userIdByEmail(event.ownerEmail) : null;
      const text = reminderMessage(event, ownerText(event.ownerEmail, userId), deps.guideUrl);
      const { posted } = await deps.poster.post(deps.channelId, text);
      if (posted) {
        await deps.store.markReminded(event.calendarId, event.eventId, event.startDate);
        sent++;
      }
    } catch (err) {
      log.error("reminder failed", { eventId: event.eventId, ...errorFields(err) });
    }
  }
  return sent;
}
