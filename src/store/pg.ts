import pg from "pg";
import {
  LAUNCH_TYPES,
  type LaunchLink,
  type LaunchStatus,
  type LaunchType,
  type StoredEvent,
} from "../types.js";
import type { Store } from "./store.js";

// Return DATE columns as "YYYY-MM-DD" strings instead of JS Dates at local midnight.
pg.types.setTypeParser(1082, (value: string) => value);

/** node-postgres doesn't read sslmode=require the way libpq does, so relax it. */
export function pgConnectionString(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (url.searchParams.get("sslmode") === "require") url.searchParams.set("sslmode", "no-verify");
  return url.toString();
}

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: pgConnectionString(databaseUrl),
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}

interface EventRow {
  calendar_id: string;
  event_id: string;
  name: string;
  status: LaunchStatus;
  type: LaunchType;
  includes_pricing: boolean;
  start_date: string;
  end_date: string;
  owner_email: string | null;
  html_link: string | null;
  links: LaunchLink[];
  slack_channel: string | null;
  reminded_for_start: string | null;
}

function toEvent(row: EventRow): StoredEvent {
  return {
    calendarId: row.calendar_id,
    eventId: row.event_id,
    name: row.name,
    status: row.status,
    // A type written by an older version of the app reads as Other rather than breaking messages.
    type: (LAUNCH_TYPES as readonly string[]).includes(row.type) ? row.type : "other",
    includesPricing: row.includes_pricing,
    startDate: row.start_date,
    endDate: row.end_date,
    ownerEmail: row.owner_email,
    htmlLink: row.html_link,
    links: row.links,
    slackChannel: row.slack_channel,
    remindedForStart: row.reminded_for_start,
  };
}

export class PgStore implements Store {
  constructor(private readonly pool: pg.Pool) {}

  async getSyncToken(calendarId: string) {
    const { rows } = await this.pool.query<{ sync_token: string }>(
      "SELECT sync_token FROM calendar_sync WHERE calendar_id = $1",
      [calendarId],
    );
    return rows[0]?.sync_token ?? null;
  }

  async setSyncToken(calendarId: string, token: string) {
    await this.pool.query(
      `INSERT INTO calendar_sync (calendar_id, sync_token) VALUES ($1, $2)
       ON CONFLICT (calendar_id) DO UPDATE SET sync_token = EXCLUDED.sync_token, updated_at = now()`,
      [calendarId, token],
    );
  }

  async getEvent(calendarId: string, eventId: string) {
    const { rows } = await this.pool.query<EventRow>(
      "SELECT * FROM launch_events WHERE calendar_id = $1 AND event_id = $2",
      [calendarId, eventId],
    );
    return rows[0] ? toEvent(rows[0]) : undefined;
  }

  async listEventIds(calendarId: string) {
    const { rows } = await this.pool.query<{ event_id: string }>(
      "SELECT event_id FROM launch_events WHERE calendar_id = $1",
      [calendarId],
    );
    return rows.map((r) => r.event_id);
  }

  async upsertEvent(e: StoredEvent) {
    await this.pool.query(
      `INSERT INTO launch_events
         (calendar_id, event_id, name, status, type, start_date, end_date, owner_email, html_link, links, slack_channel, reminded_for_start, includes_pricing)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (calendar_id, event_id) DO UPDATE SET
         name = EXCLUDED.name, status = EXCLUDED.status, type = EXCLUDED.type,
         start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
         owner_email = EXCLUDED.owner_email, html_link = EXCLUDED.html_link, links = EXCLUDED.links,
         slack_channel = EXCLUDED.slack_channel, includes_pricing = EXCLUDED.includes_pricing,
         reminded_for_start = EXCLUDED.reminded_for_start, updated_at = now()`,
      [
        e.calendarId,
        e.eventId,
        e.name,
        e.status,
        e.type,
        e.startDate,
        e.endDate,
        e.ownerEmail,
        e.htmlLink,
        JSON.stringify(e.links),
        e.slackChannel,
        e.remindedForStart,
        e.includesPricing,
      ],
    );
  }

  async deleteEvent(calendarId: string, eventId: string) {
    await this.pool.query("DELETE FROM launch_events WHERE calendar_id = $1 AND event_id = $2", [
      calendarId,
      eventId,
    ]);
  }

  async listEvents(range: { from: string; to: string }) {
    const { rows } = await this.pool.query<EventRow>(
      `SELECT * FROM launch_events WHERE end_date >= $1 AND start_date <= $2
       ORDER BY start_date, name`,
      [range.from, range.to],
    );
    return rows.map(toEvent);
  }

  async markReminded(calendarId: string, eventId: string, startDate: string) {
    await this.pool.query(
      "UPDATE launch_events SET reminded_for_start = $3 WHERE calendar_id = $1 AND event_id = $2",
      [calendarId, eventId, startDate],
    );
  }

  async claimDigest(weekStart: string, channelId: string) {
    const { rowCount } = await this.pool.query(
      "INSERT INTO digests (week_start, channel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [weekStart, channelId],
    );
    return rowCount === 1;
  }

  async setDigestMessageTs(weekStart: string, ts: string) {
    await this.pool.query("UPDATE digests SET message_ts = $2 WHERE week_start = $1", [
      weekStart,
      ts,
    ]);
  }

  async releaseDigest(weekStart: string) {
    await this.pool.query("DELETE FROM digests WHERE week_start = $1", [weekStart]);
  }

  async ping() {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}
