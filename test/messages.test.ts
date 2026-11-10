import { describe, expect, it } from "vitest";
import { changeMessage, ownerText, reminderMessage } from "../src/slack/messages.js";
import { launch } from "./support/events.js";

describe("changeMessage", () => {
  const tentative = launch({ links: [{ label: "RFC", url: "https://github.com/example/rfc/1" }] });
  const confirmed = launch({ status: "confirmed", startDate: "2026-11-24", endDate: "2026-11-24" });

  it("announces a new tentative window with its owner and links", () => {
    expect(changeMessage({ kind: "added", event: tentative }, "<@U1>")).toBe(
      [
        "🗓️ New on the launch calendar: 🧪 Public beta · *Mobile replay*, 23–27 Nov (tentative).",
        "Owner: <@U1>",
        "<https://calendar.example/e1|Calendar> · <https://github.com/example/rfc/1|RFC>",
      ].join("\n"),
    );
  });

  it("shows the old window when a date is confirmed", () => {
    expect(
      changeMessage({ kind: "confirmed", event: confirmed, before: tentative }, null),
    ).toContain(
      "✅ Date confirmed: 🧪 Public beta · *Mobile replay* on Tue 24 Nov. It was tentative for 23–27 Nov.",
    );
  });

  it("shows old and new dates when a launch moves across months", () => {
    const later = launch({ startDate: "2026-11-30", endDate: "2026-12-04" });
    expect(changeMessage({ kind: "moved", event: later, before: tentative }, null)).toContain(
      "to 30 Nov – 4 Dec (tentative). It was 23–27 Nov.",
    );
  });

  it("shows the launch channel next to the owner, clickable when it's an ID", () => {
    const withId = launch({ slackChannel: "C0123ABCDEF" });
    expect(changeMessage({ kind: "added", event: withId }, "<@U1>")).toContain(
      "\nOwner: <@U1> · Launch channel: <#C0123ABCDEF>\n",
    );
    const withName = launch({ slackChannel: "#mobile-replay-launch" });
    expect(changeMessage({ kind: "added", event: withName }, null)).toContain(
      "\nLaunch channel: #mobile-replay-launch\n",
    );
  });

  it("escapes names so they can't inject Slack markup", () => {
    const sneaky = launch({ name: "<!channel> & co" });
    expect(changeMessage({ kind: "removed", before: sneaky }, null)).toContain(
      "*&lt;!channel&gt; &amp; co*",
    );
  });
});

describe("GA + Pricing", () => {
  it("shows both in the label and adds the sales notice to the reminder", () => {
    const ga = launch({ type: "ga", includesPricing: true, name: "Example product" });
    expect(changeMessage({ kind: "added", event: ga }, null)).toContain(
      "🚀 GA + 💰 Pricing · *Example product*",
    );
    expect(reminderMessage(ga, null)).toContain("10 business days");
  });
});

describe("ownerText", () => {
  it("mentions the Slack user, or falls back to the email", () => {
    expect(ownerText("pm@example.com", "U1")).toBe("<@U1>");
    expect(ownerText("pm@example.com", null)).toBe("pm@example.com");
    expect(ownerText(null, null)).toBeNull();
  });
});

describe("reminderMessage", () => {
  it("adds the sales notice rule for pricing changes only", () => {
    expect(reminderMessage(launch({ type: "pricing" }), null)).toContain("10 business days");
    expect(reminderMessage(launch(), null)).not.toContain("10 business days");
  });

  it("addresses the owner and shows the launch channel", () => {
    const text = reminderMessage(launch({ slackChannel: "C0123ABCDEF" }), "<@U1>");
    expect(
      text.startsWith("👋 <@U1>, 🧪 Public beta · *Mobile replay* is planned for 23–27 Nov"),
    ).toBe(true);
    expect(text).toContain("\nLaunch channel: <#C0123ABCDEF>\n");
  });
});
