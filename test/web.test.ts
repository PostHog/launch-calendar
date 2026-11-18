import request from "supertest";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/store/memory.js";
import { createApp } from "../src/web.js";
import { launch } from "./support/events.js";

async function appWith(...events: Parameters<typeof launch>[0][]) {
  const store = new MemoryStore();
  for (const overrides of events)
    await store.upsertEvent({ ...launch(overrides), remindedForStart: null });
  return createApp({ store, calendarId: "cal" });
}

describe("launch page", () => {
  it("shows the launch's details, escaped, with a way back to the calendar", async () => {
    const app = await appWith({
      eventId: "abc123",
      name: "Free tier <b>change</b>",
      type: "pricing",
      summary: "Drops to 2,000 events.",
      slackChannel: "C0123ABCDEF",
      links: [
        { label: "RFC", url: "https://github.com/example/rfc/1" },
        { label: "Sneaky", url: "javascript:alert(1)" },
      ],
    });
    const res = await request(app).get("/launches/abc123");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<h1>Free tier &lt;b&gt;change&lt;/b&gt;</h1>");
    expect(res.text).toContain("Drops to 2,000 events.");
    expect(res.text).toContain('href="/?month=2026-11"');
    expect(res.text).toContain("https://slack.com/app_redirect?channel=C0123ABCDEF");
    expect(res.text).toContain('href="https://github.com/example/rfc/1"');
    expect(res.text).not.toContain("javascript:");
    expect(res.text).toContain("10 business days");
    expect(res.text).toContain('href="https://calendar.example/e1">Edit in Google Calendar');
  });

  it("is a 404 for an unknown or malformed ID", async () => {
    const app = await appWith({ eventId: "abc123" });
    expect((await request(app).get("/launches/nope")).status).toBe(404);
    expect((await request(app).get("/launches/a%20b")).status).toBe(404);
  });

  it("is what the calendar and the table link to", async () => {
    const app = await appWith({
      eventId: "abc123",
      startDate: "2026-11-30",
      endDate: "2026-12-01",
    });
    const res = await request(app).get("/?month=2026-12");
    expect(res.text).toContain('href="/launches/abc123"');
    expect(res.text).not.toContain('href="https://calendar.example/e1"');
  });
});
