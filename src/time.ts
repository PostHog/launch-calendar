import { DateTime } from "luxon";

export const LONDON = "Europe/London";

export function londonNow(now: Date = new Date()): DateTime {
  return DateTime.fromJSDate(now, { zone: LONDON });
}

/** Today in London as YYYY-MM-DD. */
export function londonToday(now: Date = new Date()): string {
  return londonNow(now).toISODate() ?? "";
}

function day(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: LONDON });
}

export function addDays(iso: string, days: number): string {
  return day(iso).plus({ days }).toISODate() ?? "";
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round(day(to).diff(day(from), "days").days);
}

/** The Monday of the week that holds `iso`. */
export function weekStart(iso: string): string {
  return day(iso).startOf("week").toISODate() ?? "";
}

/** "Tue 24 Nov" */
export function formatDay(iso: string): string {
  return day(iso).toFormat("ccc d LLL");
}

/** "Tue 24 Nov" for one day, "23–27 Nov" or "30 Nov – 4 Dec" for a range. */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDay(start);
  const a = day(start);
  const b = day(end);
  if (a.year === b.year && a.month === b.month) return `${a.day}–${b.toFormat("d LLL")}`;
  return `${a.toFormat("d LLL")} – ${b.toFormat("d LLL")}`;
}
