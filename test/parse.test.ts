import { describe, expect, it } from "vitest";
import {
  descriptionLines,
  parseEvent,
  parseLinks,
  parseSlackChannel,
  parseTitle,
} from "../src/parse.js";

describe("parseTitle", () => {
  it.each([
    [
      "[Tentative] Public beta: Session replay for mobile",
      "tentative",
      "public_beta",
      "Session replay for mobile",
    ],
    ["Pricing: [TBC] Example tiers", "tentative", "pricing", "Example tiers"],
    ["(tentative) GA - Error tracking", "tentative", "ga", "Error tracking"],
    ["Beta: Mobile replay", undefined, "public_beta", "Mobile replay"],
    ["Other: Merch store", undefined, "other", "Merch store"],
    ["[Tentative] Marketing launch: Sources", "tentative", "marketing_launch", "Sources"],
    ["[Confirmed] Launch: Example launch", "confirmed", "other", "Example launch"],
    ["Deprecation: Old toolbar", undefined, "deprecation", "Old toolbar"],
    ["Session replay for mobile", undefined, "other", "Session replay for mobile"],
  ])("reads %j", (raw, status, type, name) => {
    expect(parseTitle(raw)).toEqual({ status, type, name, includesPricing: false });
  });

  it.each([
    ["GA + Pricing: Example product", "ga"],
    ["[Tentative] GA & pricing: Example product", "ga"],
    ["Public beta and Pricing - Example product", "public_beta"],
  ])("reads %j as a release that also starts charging", (raw, type) => {
    expect(parseTitle(raw)).toMatchObject({ type, includesPricing: true, name: "Example product" });
  });

  it("doesn't double up pricing on a pricing change", () => {
    expect(parseTitle("Pricing + Pricing: Tiers")).toMatchObject({
      type: "pricing",
      includesPricing: false,
    });
  });

  it("keeps the raw title when only prefixes are present", () => {
    expect(parseTitle("[Tentative]").name).toBe("[Tentative]");
  });
});

describe("descriptions", () => {
  it("turns Google's HTML into labelled links and an owner", () => {
    const html =
      'RFC: <a href="https://github.com/example/rfc/1">https://github.com/example/rfc/1</a><br>Owner: Someone@Example.com<br>Notes without a link';
    const lines = descriptionLines(html);
    expect(lines).toEqual([
      "RFC: https://github.com/example/rfc/1",
      "Owner: Someone@Example.com",
      "Notes without a link",
    ]);
    expect(parseLinks(lines)).toEqual([{ label: "RFC", url: "https://github.com/example/rfc/1" }]);
  });

  it.each(["Marketing", "marketing issue", "Marketing launch issue"])(
    "labels a %j line as the marketing launch issue",
    (label) => {
      expect(parseLinks([`${label}: https://github.com/example/marketing/issues/1`])).toEqual([
        { label: "Marketing launch issue", url: "https://github.com/example/marketing/issues/1" },
      ]);
    },
  );

  it.each([
    ["Slack channel: https://example.slack.com/archives/C0123ABCDEF", "C0123ABCDEF"],
    ["Slack: https://example.slack.com/archives/C0123ABCDEF/p1700000000000000", "C0123ABCDEF"],
    ["Slack channel: <#C0123ABCDEF|example-launch>", "C0123ABCDEF"],
    ["Slack channel: #Example-Launch", "#example-launch"],
    ["Slack channel: example-launch", "#example-launch"],
    ["Slack channel: not a channel name", null],
  ])("reads %j as the launch channel", (line, channel) => {
    expect(parseSlackChannel([line])).toBe(channel);
    expect(parseLinks([line])).toEqual([]);
  });
});

describe("parseEvent", () => {
  const base = {
    id: "e1",
    htmlLink: "https://calendar.example/e1",
    creator: { email: "pm@example.com" },
    organizer: { email: "cal", self: true },
  };

  it("reads an all-day week as a tentative window with an inclusive end", () => {
    const result = parseEvent(
      {
        ...base,
        summary: "Public beta: Mobile replay",
        start: { date: "2026-11-23" },
        end: { date: "2026-11-28" },
      },
      "cal",
    );
    expect(result).toMatchObject({
      kind: "event",
      event: {
        status: "tentative",
        type: "public_beta",
        startDate: "2026-11-23",
        endDate: "2026-11-27",
        ownerEmail: "pm@example.com",
      },
    });
  });

  it("reads a single all-day event without a prefix as confirmed", () => {
    const result = parseEvent(
      {
        ...base,
        summary: "GA: Mobile replay",
        start: { date: "2026-11-24" },
        end: { date: "2026-11-25" },
      },
      "cal",
    );
    expect(result).toMatchObject({
      event: { status: "confirmed", startDate: "2026-11-24", endDate: "2026-11-24" },
    });
  });

  it("puts a timed event on its London day, even when it ends at midnight", () => {
    const result = parseEvent(
      {
        ...base,
        summary: "Launch: Thing",
        start: { dateTime: "2026-11-24T22:00:00-05:00" },
        end: { dateTime: "2026-11-26T00:00:00Z" },
      },
      "cal",
    );
    expect(result).toMatchObject({ event: { startDate: "2026-11-25", endDate: "2026-11-25" } });
  });

  it("prefers an Owner line over the creator", () => {
    const result = parseEvent(
      {
        ...base,
        summary: "x",
        description: "Owner: other@example.com",
        start: { date: "2026-11-24" },
      },
      "cal",
    );
    expect(result).toMatchObject({ event: { ownerEmail: "other@example.com" } });
  });

  it("skips events organised outside the calendar, even if the calendar was invited", () => {
    const invite = { ...base, organizer: { email: "someone@elsewhere.example" } };
    expect(
      parseEvent({ ...invite, summary: "GA: x", start: { date: "2026-11-24" } }, "cal").kind,
    ).toBe("skipped");
    const byId = { ...base, organizer: { email: "cal" } };
    expect(
      parseEvent({ ...byId, summary: "GA: x", start: { date: "2026-11-24" } }, "cal").kind,
    ).toBe("event");
  });

  it("treats cancelled events as removed and skips recurring ones", () => {
    expect(parseEvent({ id: "e1", status: "cancelled" }, "cal")).toEqual({
      kind: "removed",
      eventId: "e1",
    });
    expect(
      parseEvent(
        { ...base, recurrence: ["RRULE:FREQ=WEEKLY"], start: { date: "2026-11-24" } },
        "cal",
      ).kind,
    ).toBe("skipped");
  });
});
