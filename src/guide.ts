import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

/** The naming guide lives in guide/naming-guide.md: the app, the agent skill and the handbook copy it. */
export const GUIDE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../guide/naming-guide.md",
);

export function readGuide(): string {
  return readFileSync(GUIDE_PATH, "utf8");
}

let cachedHtml: string | undefined;

/** The guide as HTML. The Markdown is our own file, not user input. */
export function guideHtml(): string {
  cachedHtml ??= marked.parse(readGuide(), { async: false });
  return cachedHtml;
}
