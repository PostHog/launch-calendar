import { describe, expect, it } from "vitest";
import { diffEvent, isWorthPosting } from "../src/diff.js";
import { launch } from "./support/events.js";

describe("diffEvent", () => {
  const tentative = launch();

  it("reports a new event", () => {
    expect(diffEvent(undefined, tentative)).toEqual({ kind: "added", event: tentative });
  });

  it("reports a confirmation, even when the date narrows at the same time", () => {
    const confirmed = launch({
      status: "confirmed",
      startDate: "2026-11-24",
      endDate: "2026-11-24",
    });
    expect(diffEvent(tentative, confirmed)).toEqual({
      kind: "confirmed",
      event: confirmed,
      before: tentative,
    });
  });

  it("reports a confirmed date going back to tentative", () => {
    const confirmed = launch({
      status: "confirmed",
      startDate: "2026-11-24",
      endDate: "2026-11-24",
    });
    expect(diffEvent(confirmed, tentative)?.kind).toBe("unconfirmed");
  });

  it("reports moved dates", () => {
    const later = launch({ startDate: "2026-11-30", endDate: "2026-12-04" });
    expect(diffEvent(tentative, later)?.kind).toBe("moved");
  });

  it("ignores renames and new links", () => {
    expect(
      diffEvent(
        tentative,
        launch({ name: "Replay for mobile", links: [{ label: "RFC", url: "https://x" }] }),
      ),
    ).toBeNull();
  });

  it("reports a removal", () => {
    expect(diffEvent(tentative, undefined)).toEqual({ kind: "removed", before: tentative });
  });
});

describe("isWorthPosting", () => {
  it("skips edits to launches that are over", () => {
    const past = launch({ startDate: "2026-10-01", endDate: "2026-10-01" });
    expect(isWorthPosting({ kind: "removed", before: past }, "2026-11-10")).toBe(false);
  });

  it("keeps a past launch that moved into the future", () => {
    const past = launch({ startDate: "2026-10-01", endDate: "2026-10-01" });
    const moved = launch({ startDate: "2026-12-01", endDate: "2026-12-01" });
    expect(isWorthPosting({ kind: "moved", event: moved, before: past }, "2026-11-10")).toBe(true);
  });
});
