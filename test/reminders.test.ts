import { describe, expect, it } from "vitest";
import { dueReminders, isReminderTime, runReminders } from "../src/reminders.js";
import { MemoryStore } from "../src/store/memory.js";
import type { StoredEvent } from "../src/types.js";
import { launch } from "./support/events.js";
import { FakePoster } from "./support/fakes.js";

const TODAY = "2026-11-16";
// Monday 16 Nov 2026, 10:00 in London (GMT in November).
const MONDAY_MORNING = new Date("2026-11-16T10:00:00Z");
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

    expect(await runReminders({ store, poster, channelId: "C1" }, MONDAY_MORNING)).toBe(2);
    expect(poster.posted.map((p) => p.channel)).toEqual(["C1", "C1"]);
    expect(poster.posted[0]?.text.startsWith("👋 <@U1>, 🧪 Public beta")).toBe(true);
    expect(poster.posted[1]?.text.startsWith("👋 gone@example.com, 🧪 Public beta")).toBe(true);

    expect(await runReminders({ store, poster, channelId: "C1" }, MONDAY_MORNING)).toBe(0);
  });

  it("sends nothing without an alert channel", async () => {
    const store = new MemoryStore();
    await store.upsertEvent(
      stored({ eventId: "a", startDate: "2026-11-20", endDate: "2026-11-20" }),
    );
    const poster = new FakePoster();
    expect(await runReminders({ store, poster, channelId: undefined }, MONDAY_MORNING)).toBe(0);
    expect(poster.posted).toEqual([]);
  });
});

describe("reminder timing", () => {
  it("only sends on weekdays from 09:00 London time", () => {
    expect(isReminderTime(new Date("2026-11-12T00:01:00Z"))).toBe(false); // Thu, just after midnight
    expect(isReminderTime(new Date("2026-11-12T08:59:00Z"))).toBe(false);
    expect(isReminderTime(new Date("2026-11-12T09:00:00Z"))).toBe(true);
    expect(isReminderTime(new Date("2026-11-14T10:00:00Z"))).toBe(false); // Saturday
    expect(isReminderTime(new Date("2026-06-15T08:30:00Z"))).toBe(true); // 09:30 in London summer time
  });

  it("holds a reminder that falls due overnight until the morning", async () => {
    const store = new MemoryStore();
    await store.upsertEvent(
      stored({ eventId: "a", startDate: "2026-11-19", endDate: "2026-11-19" }),
    );
    const poster = new FakePoster();
    expect(
      await runReminders({ store, poster, channelId: "C1" }, new Date("2026-11-12T00:01:00Z")),
    ).toBe(0);
    expect(
      await runReminders({ store, poster, channelId: "C1" }, new Date("2026-11-12T09:05:00Z")),
    ).toBe(1);
  });
});
