import type { StoredEvent } from "../types.js";
import type { Store } from "./store.js";

/** In-memory store for tests and dry runs. */
export class MemoryStore implements Store {
  readonly tokens = new Map<string, string>();
  readonly events = new Map<string, StoredEvent>();
  readonly digests = new Map<string, { channelId: string; ts?: string }>();

  private key(calendarId: string, eventId: string): string {
    return `${calendarId}\u0000${eventId}`;
  }

  async getSyncToken(calendarId: string) {
    return this.tokens.get(calendarId) ?? null;
  }
  async setSyncToken(calendarId: string, token: string) {
    this.tokens.set(calendarId, token);
  }
  async getEvent(calendarId: string, eventId: string) {
    const event = this.events.get(this.key(calendarId, eventId));
    return event ? { ...event } : undefined;
  }
  async listEventIds(calendarId: string) {
    return [...this.events.values()]
      .filter((e) => e.calendarId === calendarId)
      .map((e) => e.eventId);
  }
  async upsertEvent(event: StoredEvent) {
    this.events.set(this.key(event.calendarId, event.eventId), { ...event });
  }
  async deleteEvent(calendarId: string, eventId: string) {
    this.events.delete(this.key(calendarId, eventId));
  }
  async listEvents(range: { from: string; to: string }) {
    return [...this.events.values()]
      .filter((e) => e.endDate >= range.from && e.startDate <= range.to)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name))
      .map((e) => ({ ...e }));
  }
  async markReminded(calendarId: string, eventId: string, startDate: string) {
    const event = this.events.get(this.key(calendarId, eventId));
    if (event) event.remindedForStart = startDate;
  }
  async claimDigest(weekStart: string, channelId: string) {
    if (this.digests.has(weekStart)) return false;
    this.digests.set(weekStart, { channelId });
    return true;
  }
  async setDigestMessageTs(weekStart: string, ts: string) {
    const digest = this.digests.get(weekStart);
    if (digest) digest.ts = ts;
  }
  async releaseDigest(weekStart: string) {
    this.digests.delete(weekStart);
  }
  async ping() {
    return true;
  }
}
