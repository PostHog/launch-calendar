import { describe, expect, it } from "vitest";
import request from "supertest";
import { runTick } from "../src/runner.js";
import { MemoryStore } from "../src/store/memory.js";
import { londonToday } from "../src/time.js";
import { createApp } from "../src/web.js";
import { FakeCalendar, FakePoster, allDay } from "./support/fakes.js";

// A Tuesday, so the Monday digest doesn't fire.
const NOW = new Date("2026-11-10T12:00:00Z");

describe("runTick", () => {
  it("posts nothing on the baseline sync, then posts each change to the alert channel", async () => {
    const store = new MemoryStore();
    const calendar = new FakeCalendar();
    const poster = new FakePoster(true, { "pm@example.com": "U1" });
    const deps = { store, source: calendar, poster, calendarId: "cal", channelId: "C1" };

    calendar.put(allDay("a", "[Tentative] GA: Mobile replay", "2026-12-07", "2026-12-12"));
    expect(await runTick(deps, NOW)).toMatchObject({ baseline: true, changesPosted: 0 });

    calendar.put(allDay("a", "GA: Mobile replay", "2026-12-08", "2026-12-09"));
    expect(await runTick(deps, NOW)).toMatchObject({ changesPosted: 1, digest: "not_time" });
    expect(poster.posted[0]).toMatchObject({ channel: "C1" });
    expect(poster.posted[0]?.text).toContain(
      "✅ Date confirmed: 🚀 GA · *Mobile replay* on Tue 8 Dec",
    );
    expect(poster.posted[0]?.text).toContain("Owner: <@U1>");
  });

  it("reports a failed Google call instead of looking like a quiet sync", async () => {
    const failing = {
      listChanges: async () => {
        throw new Error("invalid_grant");
      },
    };
    const deps = {
      store: new MemoryStore(),
      source: failing,
      poster: new FakePoster(),
      calendarId: "cal",
      channelId: "C1",
    };
    expect(await runTick(deps, NOW)).toMatchObject({ sync: "failed", syncError: "invalid_grant" });
  });
});

describe("web", () => {
  it("lists upcoming launches with names escaped, and answers /ping", async () => {
    const store = new MemoryStore();
    const today = londonToday();
    await store.upsertEvent({
      calendarId: "cal",
      eventId: "x",
      name: "<script>alert(1)</script>",
      status: "tentative",
      type: "public_beta",
      includesPricing: false,
      startDate: today,
      endDate: today,
      ownerEmail: null,
      htmlLink: "javascript:alert(1)",
      links: [],
      slackChannel: null,
      remindedForStart: null,
    });
    const app = createApp({ store });

    const home = await request(app).get("/");
    expect(home.status).toBe(200);
    expect(home.text).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(home.text).not.toContain("javascript:");
    expect(home.text).toContain("<td>Public beta</td>");

    expect((await request(app).get("/ping")).text).toBe("ok");
  });

  it("renders the naming guide from guide/naming-guide.md", async () => {
    const res = await request(createApp({ store: new MemoryStore() })).get("/guide");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<h1>How to add a launch to the launch calendar</h1>");
    expect(res.text).toContain("<code>[Tentative] Public beta: Session replay for mobile</code>");
  });
});

describe("security: invitations from outside the calendar", () => {
  it("ignores an event someone else organised and invited the calendar to", async () => {
    const store = new MemoryStore();
    const calendar = new FakeCalendar();
    const poster = new FakePoster(true, { "ceo@example.com": "U9" });
    const deps = { store, source: calendar, poster, calendarId: "cal", channelId: "C1" };
    await runTick(deps, NOW); // baseline

    // Anyone who knows the calendar's address can invite it to an event they organise.
    calendar.put({
      id: "invite",
      summary: "GA: Urgent, re-authenticate your account",
      description: "Owner: ceo@example.com<br>RFC: https://attacker.example/login",
      start: { date: "2026-11-20" },
      end: { date: "2026-11-21" },
      organizer: { email: "attacker@attacker.example" },
      creator: { email: "attacker@attacker.example" },
    });
    await runTick(deps, NOW);

    expect(poster.posted).toEqual([]);
    expect(await store.getEvent("cal", "invite")).toBeUndefined();
  });
});
