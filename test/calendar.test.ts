import { describe, expect, it } from "vitest";
import {
  gridRange,
  layoutMonth,
  layoutWeek,
  monthTitle,
  parseMonth,
  shiftMonth,
} from "../src/calendar.js";
import type { StoredEvent } from "../src/types.js";
import { launch } from "./support/events.js";

const ev = (eventId: string, startDate: string, endDate: string): StoredEvent => ({
  ...launch({ eventId, name: eventId, startDate, endDate }),
  remindedForStart: null,
});

describe("months", () => {
  it("reads ?month= and falls back to the current month", () => {
    expect(parseMonth("2026-12", "2026-11-18")).toBe("2026-12");
    expect(parseMonth("2026-13", "2026-11-18")).toBe("2026-11");
    expect(parseMonth(["2026-12"], "2026-11-18")).toBe("2026-11");
    expect(parseMonth(undefined, "2026-11-18")).toBe("2026-11");
  });

  it("moves across years and names the month", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(monthTitle("2026-12")).toBe("December 2026");
  });

  it("covers whole weeks, Monday to Sunday", () => {
    // December 2026 starts on a Tuesday and ends on a Thursday.
    expect(gridRange("2026-12")).toEqual({ from: "2026-11-30", to: "2027-01-03" });
    expect(layoutMonth("2026-12", [])).toHaveLength(5);
  });
});

describe("layoutWeek", () => {
  it("places a one-day launch in its column", () => {
    const row = layoutWeek("2026-11-30", [ev("ga", "2026-12-01", "2026-12-01")]);
    expect(row.segments).toMatchObject([{ startCol: 2, span: 1, lane: 0 }]);
    expect(row.days[0]).toBe("2026-11-30");
  });

  it("stacks overlapping launches and reuses a lane once it's free", () => {
    const row = layoutWeek("2026-11-30", [
      ev("week", "2026-11-30", "2026-12-04"),
      ev("tue", "2026-12-01", "2026-12-01"),
      ev("sat", "2026-12-05", "2026-12-05"),
    ]);
    const lanes = Object.fromEntries(row.segments.map((s) => [s.event.eventId, s.lane]));
    expect(lanes).toEqual({ week: 0, tue: 1, sat: 0 });
    expect(row.lanes).toBe(2);
  });

  it("cuts a month-long launch at the week edges and marks it as continuing", () => {
    const row = layoutWeek("2026-12-07", [ev("dec", "2026-12-01", "2026-12-31")]);
    expect(row.segments).toMatchObject([
      { startCol: 1, span: 7, continuesBefore: true, continuesAfter: true },
    ]);
  });

  it("leaves out launches from other weeks", () => {
    expect(layoutWeek("2026-12-07", [ev("old", "2026-11-02", "2026-11-06")]).segments).toEqual([]);
  });
});
