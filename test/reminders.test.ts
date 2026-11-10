import { describe, expect, it } from "vitest";
import { dueReminders, runReminders } from "../src/reminders.js";
import { MemoryStore } from "../src/store/memory.js";
import type { StoredEvent } from "../src/types.js";
import { launch } from "./support/events.js";
import { FakePoster } from "./support/fakes.js";

const TODAY = "2026-11-16";
const stored = (overrides: Partial<StoredEvent>): StoredEvent => ({
  ...launch(overrides),
  remindedForStart: null,
  ...overrides,
});

describe("dueReminders", () => {
  it("picks tentative launches inside their lead time that weren't reminded for this date", () => {
    const events = [
      stored({ eventId: "soon", startDate: "2026-11-23", endDate: "2026-11-27" }),
      stored({ eventId: "too-far", startDate: "2026-11-30", endDate: "2026-12-04" }),
      stored({
        eventId: "pricing",
        type: "pricing",
        startDate: "2026-11-30",
        endDate: "2026-12-04",
      }),
      stored({
        eventId: "confirmed",
        status: "confirmed",
        startDate: "2026-11-18",
        endDate: "2026-11-18",
      }),
      stored({
        eventId: "done",
        startDate: "2026-11-20",
        endDate: "2026-11-20",
        remindedForStart: "2026-11-20",
      }),
    ];
    expect(dueReminders(events, TODAY).map((e) => e.eventId)).toEqual(["soon", "pricing"]);
    const gaWithPricing = stored({
      eventId: "ga",
      type: "ga",
      includesPricing: true,
      startDate: "2026-11-30",
      endDate: "2026-11-30",
    });
    expect(dueReminders([gaWithPricing], TODAY).map((e) => e.eventId)).toEqual(["ga"]);
  });
});

describe("runReminders", () => {
  it("posts once in the alert channel, mentioning the owner or naming their email", async () => {
    const store = new MemoryStore();
    await store.upsertEvent(
      stored({ eventId: "a", startDate: "2026-11-20", endDate: "2026-11-20" }),
    );
    await store.upsertEvent(
      stored({
        eventId: "b",
        ownerEmail: "gone@example.com",
        startDate: "2026-11-21",
        endDate: "2026-11-21",
      }),
    );
    const poster = new FakePoster(true, { "pm@example.com": "U1" });

    expect(await runReminders({ store, poster, channelId: "C1" }, TODAY)).toBe(2);
    expect(poster.posted.map((p) => p.channel)).toEqual(["C1", "C1"]);
    expect(poster.posted[0]?.text.startsWith("👋 <@U1>, 🧪 Public beta")).toBe(true);
    expect(poster.posted[1]?.text.startsWith("👋 gone@example.com, 🧪 Public beta")).toBe(true);

    expect(await runReminders({ store, poster, channelId: "C1" }, TODAY)).toBe(0);
  });

  it("sends nothing without an alert channel", async () => {
    const store = new MemoryStore();
    await store.upsertEvent(
      stored({ eventId: "a", startDate: "2026-11-20", endDate: "2026-11-20" }),
    );
    const poster = new FakePoster();
    expect(await runReminders({ store, poster, channelId: undefined }, TODAY)).toBe(0);
    expect(poster.posted).toEqual([]);
  });
});
