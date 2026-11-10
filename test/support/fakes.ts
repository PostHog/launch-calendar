import type { calendar_v3 } from "@googleapis/calendar";
import {
  SyncTokenExpired,
  type CalendarSource,
  type ChangePage,
} from "../../src/google/calendar.js";
import type { Poster } from "../../src/slack/client.js";

/** A calendar that hands out sync tokens and returns only what changed since each one. */
export class FakeCalendar implements CalendarSource {
  private events = new Map<string, calendar_v3.Schema$Event>();
  private log: { version: number; id: string }[] = [];
  private version = 0;
  expireTokens = false;
  calls: (string | null)[] = [];

  put(event: calendar_v3.Schema$Event): void {
    this.events.set(event.id ?? "", event);
    this.log.push({ version: ++this.version, id: event.id ?? "" });
  }

  remove(id: string): void {
    this.events.set(id, { id, status: "cancelled" });
    this.log.push({ version: ++this.version, id });
  }

  async listChanges(_calendarId: string, syncToken: string | null): Promise<ChangePage> {
    this.calls.push(syncToken);
    if (syncToken && this.expireTokens) {
      this.expireTokens = false;
      throw new SyncTokenExpired();
    }
    const since = syncToken ? Number(syncToken) : 0;
    const ids = syncToken
      ? new Set(this.log.filter((l) => l.version > since).map((l) => l.id))
      : new Set(
          [...this.events.values()].filter((e) => e.status !== "cancelled").map((e) => e.id ?? ""),
        );
    return {
      items: [...ids].map((id) => this.events.get(id) ?? { id }),
      nextSyncToken: String(this.version),
    };
  }
}

export interface Posted {
  channel: string;
  text: string;
}

export class FakePoster implements Poster {
  posted: Posted[] = [];
  constructor(
    public enabled = true,
    private readonly users: Record<string, string> = {},
  ) {}
  async post(channel: string, text: string) {
    if (!this.enabled) return { posted: false };
    this.posted.push({ channel, text });
    return { posted: true, ts: String(this.posted.length) };
  }
  async userIdByEmail(email: string) {
    return this.users[email] ?? null;
  }
}

export function allDay(
  id: string,
  summary: string,
  start: string,
  endExclusive: string,
): calendar_v3.Schema$Event {
  return {
    id,
    summary,
    start: { date: start },
    end: { date: endExclusive },
    htmlLink: `https://calendar.example/${id}`,
    creator: { email: "pm@example.com" },
    organizer: { email: "cal", self: true },
  };
}
