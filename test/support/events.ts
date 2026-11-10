import type { LaunchEvent } from "../../src/types.js";

export function launch(overrides: Partial<LaunchEvent> = {}): LaunchEvent {
  return {
    calendarId: "cal",
    eventId: "e1",
    name: "Mobile replay",
    status: "tentative",
    type: "public_beta",
    includesPricing: false,
    startDate: "2026-11-23",
    endDate: "2026-11-27",
    ownerEmail: "pm@example.com",
    htmlLink: "https://calendar.example/e1",
    links: [],
    slackChannel: null,
    ...overrides,
  };
}
