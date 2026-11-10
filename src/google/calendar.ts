import { auth, calendar, type calendar_v3 } from "@googleapis/calendar";

/** Read-only is enough for the prototype. The web form will need calendar.events later. */
export const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events.readonly"];

export type GoogleCredentials =
  | { kind: "oauth"; clientId: string; clientSecret: string; refreshToken: string }
  | { kind: "delegated"; serviceAccountJson: string; impersonate: string };

export class SyncTokenExpired extends Error {
  constructor() {
    super("Google sync token expired");
  }
}

export interface ChangePage {
  items: calendar_v3.Schema$Event[];
  nextSyncToken: string;
}

/** Where events come from. A fake implements this in tests. */
export interface CalendarSource {
  /** All events when `syncToken` is null, otherwise only what changed since that token. */
  listChanges(calendarId: string, syncToken: string | null): Promise<ChangePage>;
}

/**
 * Option C in the PRD: a refresh token from one person's Google sign-in.
 * Option B: a service account with domain-wide delegation acting as one bot user.
 */
export function createCalendarApi(credentials: GoogleCredentials): calendar_v3.Calendar {
  if (credentials.kind === "oauth") {
    const client = new auth.OAuth2(credentials.clientId, credentials.clientSecret);
    client.setCredentials({ refresh_token: credentials.refreshToken });
    return calendar({ version: "v3", auth: client });
  }
  const key = JSON.parse(credentials.serviceAccountJson) as {
    client_email: string;
    private_key: string;
  };
  const client = new auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: CALENDAR_SCOPES,
    subject: credentials.impersonate,
  });
  return calendar({ version: "v3", auth: client });
}

function httpStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const value of [e.status, e.code, e.response?.status]) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }
  return undefined;
}

export class GoogleCalendarSource implements CalendarSource {
  constructor(private readonly api: calendar_v3.Calendar) {}

  async listChanges(calendarId: string, syncToken: string | null): Promise<ChangePage> {
    const items: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    do {
      let data: calendar_v3.Schema$Events;
      try {
        // Keep the same parameters on every request: Google rejects most filters next to a syncToken.
        const res = await this.api.events.list({
          calendarId,
          maxResults: 250,
          syncToken: syncToken ?? undefined,
          pageToken,
        });
        data = res.data;
      } catch (err) {
        if (httpStatus(err) === 410) throw new SyncTokenExpired();
        throw err;
      }
      items.push(...(data.items ?? []));
      pageToken = data.nextPageToken ?? undefined;
      nextSyncToken = data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    if (!nextSyncToken) throw new Error("Google returned no sync token on the last page");
    return { items, nextSyncToken };
  }
}
