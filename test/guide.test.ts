import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readGuide } from "../src/guide.js";
import { parseTitle } from "../src/parse.js";
import { LAUNCH_TYPES } from "../src/types.js";

const guide = readGuide();
const skill = readFileSync(new URL("../skills/launch-calendar/SKILL.md", import.meta.url), "utf8");

describe("naming guide", () => {
  it("parses every example title the way the guide says", () => {
    const titles = [...guide.matchAll(/^\| [^|]+\| `([^`]+)` +\|$/gm)].map((m) => m[1] ?? "");
    expect(titles.length).toBeGreaterThanOrEqual(6);
    for (const title of titles) {
      const parsed = parseTitle(title);
      expect(parsed.status === "tentative", title).toBe(title.startsWith("[Tentative]"));
      expect(parsed.type, title).not.toBe("other");
    }
  });

  it("shows the bad example as untyped, as the guide claims", () => {
    expect(parseTitle("Example product - Grandfathered pricing ends").type).toBe("other");
  });

  it("names a prefix and a color for every type, in the guide and the skill", () => {
    const prefix = {
      public_beta: "Public beta",
      ga: "GA",
      pricing: "Pricing",
      billing: "Billing",
      deprecation: "Deprecation",
      marketing_launch: "Marketing launch",
      other: "Other",
    };
    for (const type of LAUNCH_TYPES) {
      expect(guide).toContain(`\`${prefix[type]}:\``);
      expect(guide).toMatch(new RegExp(`^\\| ${prefix[type]} +\\| `, "m"));
      expect(skill).toContain(`${prefix[type]} \``);
    }
  });
});
