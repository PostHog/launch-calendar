import type { StoredEvent } from "../types.js";

/**
 * The app's own state. Everything here can be rebuilt from Google Calendar:
 * it is a snapshot used to spot changes, plus bookkeeping so nothing posts twice.
 */
export interface Store {
  getSyncToken(calendarId: string): Promise<string | null>;
  setSyncToken(calendarId: string, token: string): Promise<void>;
  getEvent(calendarId: string, eventId: string): Promise<StoredEvent | undefined>;
  listEventIds(calendarId: string): Promise<string[]>;
  upsertEvent(event: StoredEvent): Promise<void>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  /** Events that overlap the range, earliest first. */
  listEvents(range: { from: string; to: string }): Promise<StoredEvent[]>;
  markReminded(calendarId: string, eventId: string, startDate: string): Promise<void>;
  /** True when this call claimed the week. A second claim for the same week returns false. */
  claimDigest(weekStart: string, channelId: string): Promise<boolean>;
  setDigestMessageTs(weekStart: string, ts: string): Promise<void>;
  releaseDigest(weekStart: string): Promise<void>;
  ping(): Promise<boolean>;
}
