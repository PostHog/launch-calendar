import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "../src/store/memory.js";
import { syncCalendar } from "../src/sync.js";
import { FakeCalendar, allDay } from "./support/fakes.js";

const TODAY = "2026-11-10";

describe("syncCalendar", () => {
  let store: MemoryStore;
  let calendar: FakeCalendar;
  const sync = () => syncCalendar({ store, source: calendar }, "cal", TODAY);

  beforeEach(() => {
    store = new MemoryStore();
    calendar = new FakeCalendar();
    calendar.put(allDay("a", "[Tentative] Public beta: Mobile replay", "2026-11-23", "2026-11-28"));
  });

  it("records a baseline on the first sync without reporting anything", async () => {
    const result = await sync();
    expect(result).toMatchObject({ baseline: true, changes: [] });
    expect(await store.getEvent("cal", "a")).toMatchObject({
      status: "tentative",
      endDate: "2026-11-27",
    });
  });

  it("reports additions, confirmations and removals after the baseline", async () => {
    await sync();
    calendar.put(allDay("b", "Pricing: [Tentative] Example tiers", "2026-11-30", "2026-12-05"));
    calendar.put(allDay("a", "Public beta: Mobile replay", "2026-11-24", "2026-11-25"));
    expect((await sync()).changes.map((c) => c.kind)).toEqual(["added", "confirmed"]);

    calendar.remove("b");
    const result = await sync();
    expect(result.changes).toMatchObject([{ kind: "removed", before: { eventId: "b" } }]);
    expect(await store.getEvent("cal", "b")).toBeUndefined();
  });

  it("stays quiet when nothing that matters changed", async () => {
    await sync();
    calendar.put(
      allDay("a", "[Tentative] Public beta: Mobile session replay", "2026-11-23", "2026-11-28"),
    );
    expect((await sync()).changes).toEqual([]);
  });

  it("clears the reminder when a launch moves", async () => {
    await sync();
    await store.markReminded("cal", "a", "2026-11-23");
    calendar.put(allDay("a", "[Tentative] Public beta: Mobile replay", "2026-11-30", "2026-12-05"));
    await sync();
    expect((await store.getEvent("cal", "a"))?.remindedForStart).toBeNull();
  });

  it("recovers from an expired token and still spots what changed and what was deleted", async () => {
    calendar.put(allDay("b", "GA: Error tracking", "2026-12-01", "2026-12-02"));
    await sync();
    calendar.put(allDay("a", "[Tentative] Public beta: Mobile replay", "2026-11-30", "2026-12-05"));
    calendar.remove("b");
    calendar.expireTokens = true;

    const result = await sync();
    expect(calendar.calls.slice(-2)).toEqual(["2", null]);
    expect(result.changes.map((c) => c.kind).sort()).toEqual(["moved", "removed"]);
  });

  it("doesn't report edits to launches that are over", async () => {
    calendar.put(allDay("old", "GA: Something old", "2026-10-01", "2026-10-02"));
    await sync();
    calendar.remove("old");
    expect((await sync()).changes).toEqual([]);
  });
});
