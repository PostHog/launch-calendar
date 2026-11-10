import { diffEvent, isWorthPosting } from "./diff.js";
import { SyncTokenExpired, type CalendarSource } from "./google/calendar.js";
import { log } from "./log.js";
import { parseEvent } from "./parse.js";
import type { Store } from "./store/store.js";
import type { Change } from "./types.js";

export interface SyncResult {
  calendarId: string;
  /** Changes worth posting. Empty on the first sync, which only records a baseline. */
  changes: Change[];
  baseline: boolean;
  fetched: number;
}

/**
 * Pulls changes from one calendar, updates the snapshot and returns what moved.
 * When the sync token has expired it lists everything and compares against the snapshot,
 * so changes made in the meantime still get posted.
 */
export async function syncCalendar(
  deps: { store: Store; source: CalendarSource },
  calendarId: string,
  today: string,
): Promise<SyncResult> {
  const { store, source } = deps;
  const token = await store.getSyncToken(calendarId);
  const knownIds = await store.listEventIds(calendarId);
  const baseline = token === null && knownIds.length === 0;

  let fullListing = token === null;
  let page;
  try {
    page = await source.listChanges(calendarId, token);
  } catch (err) {
    if (!(err instanceof SyncTokenExpired)) throw err;
    log.warn("sync token expired, listing the whole calendar", { calendarId });
    fullListing = true;
    page = await source.listChanges(calendarId, null);
  }

  const changes: Change[] = [];
  const present = new Set<string>();

  for (const raw of page.items) {
    const parsed = parseEvent(raw, calendarId);
    const eventId = parsed.kind === "event" ? parsed.event.eventId : parsed.eventId;
    if (!eventId) continue;
    const before = await store.getEvent(calendarId, eventId);

    if (parsed.kind !== "event") {
      if (parsed.kind === "skipped")
        log.info("event skipped", { calendarId, eventId, reason: parsed.reason });
      if (before) {
        await store.deleteEvent(calendarId, eventId);
        changes.push({ kind: "removed", before });
      }
      continue;
    }

    present.add(eventId);
    const after = parsed.event;
    const change = diffEvent(before, after);
    await store.upsertEvent({
      ...after,
      // A launch that moved gets a fresh reminder for its new date.
      remindedForStart:
        before && before.startDate === after.startDate ? before.remindedForStart : null,
    });
    if (change) changes.push(change);
  }

  if (fullListing) {
    for (const eventId of knownIds) {
      if (present.has(eventId)) continue;
      const before = await store.getEvent(calendarId, eventId);
      if (!before) continue;
      await store.deleteEvent(calendarId, eventId);
      changes.push({ kind: "removed", before });
    }
  }

  await store.setSyncToken(calendarId, page.nextSyncToken);
  return {
    calendarId,
    changes: baseline ? [] : changes.filter((c) => isWorthPosting(c, today)),
    baseline,
    fetched: page.items.length,
  };
}
