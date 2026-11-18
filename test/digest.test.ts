import { describe, expect, it } from "vitest";
import { buildDigest, digestRange, runDigestTick, shouldPostDigest } from "../src/digest.js";
import { MemoryStore } from "../src/store/memory.js";
import { launch } from "./support/events.js";
import { FakePoster } from "./support/fakes.js";

const stored = (overrides: Parameters<typeof launch>[0]) => ({
  ...launch(overrides),
  remindedForStart: null,
});

// Monday 16 Nov 2026, 09:30 in London (GMT in November).
const MONDAY_MORNING = new Date("2026-11-16T09:30:00Z");

describe("shouldPostDigest", () => {
  it("is true on Monday from 09:00 London time", () => {
    expect(shouldPostDigest(MONDAY_MORNING)).toBe(true);
    expect(shouldPostDigest(new Date("2026-11-16T08:59:00Z"))).toBe(false);
    expect(shouldPostDigest(new Date("2026-11-17T09:30:00Z"))).toBe(false);
  });
});

describe("buildDigest", () => {
  const links = {
    calendarUrl: "https://calendar.example",
    howItWorksUrl: "https://app.example/guide",
    appUrl: "https://app.example",
  };

  it("lists this month with summaries, next month in one line each, and counts the rest", () => {
    const text = buildDigest(
      [
        stored({
          eventId: "a",
          name: "Ongoing",
          startDate: "2026-10-28",
          endDate: "2026-11-18",
          summary: "Already underway",
        }),
        stored({
          eventId: "b",
          name: "Late November",
          status: "confirmed",
          type: "ga",
          startDate: "2026-11-30",
          endDate: "2026-11-30",
        }),
        stored({
          eventId: "c",
          name: "December",
          type: "pricing",
          startDate: "2026-12-07",
          endDate: "2026-12-11",
          summary: "Not shown for next month",
        }),
        stored({ eventId: "d", startDate: "2027-01-04", endDate: "2027-01-04" }),
        stored({ eventId: "e", startDate: "2027-02-01", endDate: "2027-02-05" }),
      ],
      "2026-11-16",
      links,
    );
    expect(text).toBe(
      [
        "*🚀 Launches and pricing changes*",
        "",
        "*This month (November)*",
        "• 🧪 Public beta · *<https://app.example/launches/a|Ongoing>*, 28 Oct – 18 Nov (tentative). Already underway.",
        "• 🚀 GA · *<https://app.example/launches/b|Late November>*, Mon 30 Nov",
        "",
        "*Next month (December)*",
        "• 💰 Pricing change · *<https://app.example/launches/c|December>*, 7–11 Dec (tentative)",
        "",
        "2 more after December on the launch calendar. Tentative dates can still move.",
        "<https://calendar.example|Open the launch calendar> · <https://app.example/guide|How it works>",
      ].join("\n"),
    );
  });

  it("says when a month has nothing planned", () => {
    const text = buildDigest(
      [stored({ eventId: "jan", startDate: "2027-01-04", endDate: "2027-01-04" })],
      "2026-11-16",
    );
    expect(text).toContain("*This month (November)*\nNothing planned.");
    expect(text).toContain("*Next month (December)*\nNothing planned.");
    expect(text).toContain("1 more after December");
  });

  it("names next month across the new year and leaves names unlinked without an app URL", () => {
    const text = buildDigest(
      [stored({ eventId: "jan", name: "A <b>", startDate: "2027-01-04", endDate: "2027-01-04" })],
      "2026-12-14",
    );
    expect(text).toContain("*Next month (January)*\n• 🧪 Public beta · *A &lt;b&gt;*, Mon 4 Jan");
  });

  it("says so when nothing is coming", () => {
    expect(buildDigest([], "2026-11-16")).toContain("Nothing upcoming on the launch calendar.");
  });
});

describe("digestRange", () => {
  it("includes launches months away and ongoing ones, but not finished ones", async () => {
    const store = new MemoryStore();
    await store.upsertEvent(
      stored({ eventId: "jan", startDate: "2027-01-01", endDate: "2027-01-01" }),
    );
    await store.upsertEvent(
      stored({ eventId: "ongoing", startDate: "2026-11-12", endDate: "2026-11-18" }),
    );
    await store.upsertEvent(
      stored({ eventId: "done", startDate: "2026-11-02", endDate: "2026-11-06" }),
    );
    const ids = (await store.listEvents(digestRange("2026-11-16"))).map((e) => e.eventId);
    expect(ids).toEqual(["ongoing", "jan"]);
  });
});

describe("runDigestTick", () => {
  it("posts once per week", async () => {
    const store = new MemoryStore();
    const poster = new FakePoster();
    const deps = { store, poster, channelId: "C1" };
    expect(await runDigestTick(deps, MONDAY_MORNING)).toBe("posted");
    expect(await runDigestTick(deps, new Date("2026-11-16T10:00:00Z"))).toBe("already_posted");
    expect(poster.posted).toHaveLength(1);
  });

  it("doesn't claim the week while posting is off", async () => {
    const store = new MemoryStore();
    expect(
      await runDigestTick(
        { store, poster: new FakePoster(false), channelId: "C1" },
        MONDAY_MORNING,
      ),
    ).toBe("posting_disabled");
    expect(
      await runDigestTick({ store, poster: new FakePoster(true), channelId: "C1" }, MONDAY_MORNING),
    ).toBe("posted");
  });
});
