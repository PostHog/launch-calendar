import { DateTime } from "luxon";
import { LONDON, addDays, weekStart } from "./time.js";
import type { StoredEvent } from "./types.js";

/** One event's bar within one week row of the month grid. */
export interface Segment {
  event: StoredEvent;
  /** 1 = Monday … 7 = Sunday. */
  startCol: number;
  span: number;
  /** 0-based row under the day numbers, so overlapping launches stack instead of colliding. */
  lane: number;
  /** The event started in an earlier week. */
  continuesBefore: boolean;
  /** The event carries on into the next week. */
  continuesAfter: boolean;
}

export interface WeekRow {
  /** Seven YYYY-MM-DD dates, Monday first. */
  days: string[];
  segments: Segment[];
  lanes: number;
}

/** "2026-12", or the current London month when the value is missing or malformed. */
export function parseMonth(value: unknown, today: string): string {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return today.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  return DateTime.fromISO(`${month}-01`, { zone: LONDON })
    .plus({ months: delta })
    .toFormat("yyyy-LL");
}

/** "December 2026" */
export function monthTitle(month: string): string {
  return DateTime.fromISO(`${month}-01`, { zone: LONDON }).toFormat("LLLL yyyy");
}

/** First and last day shown in the month grid: whole weeks, Monday to Sunday. */
export function gridRange(month: string): { from: string; to: string } {
  const first = `${month}-01`;
  const last = DateTime.fromISO(first, { zone: LONDON }).endOf("month").toISODate() ?? first;
  return { from: weekStart(first), to: addDays(weekStart(last), 6) };
}

/** Longer events first within a day, so they take the top lanes and short ones fill gaps. */
function byStartThenLength(a: StoredEvent, b: StoredEvent): number {
  return (
    a.startDate.localeCompare(b.startDate) ||
    b.endDate.localeCompare(a.endDate) ||
    a.name.localeCompare(b.name)
  );
}

export function layoutWeek(monday: string, events: StoredEvent[]): WeekRow {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sunday = days[6] ?? monday;
  const inWeek = events
    .filter((e) => e.endDate >= monday && e.startDate <= sunday)
    .sort(byStartThenLength);

  // lanesEnd[lane] = last column taken in that lane.
  const lanesEnd: number[] = [];
  const segments: Segment[] = [];
  for (const event of inWeek) {
    const start = event.startDate < monday ? monday : event.startDate;
    const end = event.endDate > sunday ? sunday : event.endDate;
    const startCol = days.indexOf(start) + 1;
    const endCol = days.indexOf(end) + 1;
    let lane = lanesEnd.findIndex((taken) => taken < startCol);
    if (lane === -1) lane = lanesEnd.length;
    lanesEnd[lane] = endCol;
    segments.push({
      event,
      startCol,
      span: endCol - startCol + 1,
      lane,
      continuesBefore: event.startDate < monday,
      continuesAfter: event.endDate > sunday,
    });
  }
  return { days, segments, lanes: lanesEnd.length };
}

export function layoutMonth(month: string, events: StoredEvent[]): WeekRow[] {
  const { from, to } = gridRange(month);
  const rows: WeekRow[] = [];
  for (let monday = from; monday <= to; monday = addDays(monday, 7)) {
    rows.push(layoutWeek(monday, events));
  }
  return rows;
}
