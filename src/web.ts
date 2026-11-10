import express, { type Express } from "express";
import { buildDigest, digestRange } from "./digest.js";
import { guideHtml } from "./guide.js";
import { TYPE_LABEL } from "./slack/messages.js";
import type { Store } from "./store/store.js";
import { formatRange, londonToday } from "./time.js";
import type { StoredEvent } from "./types.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string | null {
  return /^https:\/\//i.test(url) ? escapeHtml(url) : null;
}

function row(event: StoredEvent): string {
  const href = event.htmlLink ? safeHref(event.htmlLink) : null;
  const name = href ? `<a href="${href}">${escapeHtml(event.name)}</a>` : escapeHtml(event.name);
  return `<tr class="${event.status}"><td>${escapeHtml(formatRange(event.startDate, event.endDate))}</td><td>${escapeHtml((TYPE_LABEL[event.type] ?? event.type) + (event.includesPricing ? " + Pricing" : ""))}</td><td>${name}</td><td>${escapeHtml(event.status)}</td><td>${escapeHtml(event.ownerEmail ?? "")}</td></tr>`;
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1d1f27;--muted:#6b6f7b;--line:#e3e4e8}
@media (prefers-color-scheme:dark){:root{--bg:#16171c;--fg:#eceef2;--muted:#9a9eab;--line:#2c2e36}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:960px;padding:24px 16px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
th{color:var(--muted);font-weight:600}tr.tentative td{color:var(--muted)}a{color:inherit}pre{white-space:pre-wrap}
code{background:var(--line);border-radius:4px;padding:1px 4px}pre code{background:none;padding:0}
pre:has(code){background:var(--line);border-radius:8px;padding:12px}nav{color:var(--muted);margin-bottom:8px}
</style></head><body>${body}</body></html>`;
}

function nav(calendarUrl: string | undefined): string {
  const links = [
    `<a href="/">Upcoming</a>`,
    `<a href="/guide">Naming guide</a>`,
    `<a href="/digest">Digest preview</a>`,
  ];
  const href = calendarUrl ? safeHref(calendarUrl) : null;
  if (href) links.push(`<a href="${href}">Open in Google Calendar</a>`);
  return `<nav>${links.join(" · ")}</nav>`;
}

export function createApp(deps: { store: Store; calendarUrl?: string }): Express {
  const app = express();
  app.disable("x-powered-by");

  // The only public path on HostHog. The keepalive workflow calls it.
  app.get("/ping", (_req, res) => {
    res.type("text").send("ok");
  });

  app.get("/healthz", async (_req, res) => {
    res.json({ ok: true, db: await deps.store.ping() });
  });

  app.get("/", async (_req, res) => {
    const today = londonToday();
    const events = await deps.store.listEvents(digestRange(today));
    const rows = events.length
      ? events.map(row).join("")
      : `<tr><td colspan="5">Nothing upcoming on the launch calendar.</td></tr>`;
    res.send(
      page(
        "Launch calendar",
        `${nav(deps.calendarUrl)}<h1>Launch calendar</h1><p>All upcoming launches and pricing changes. Tentative dates are greyed out. Adding one? Read the <a href="/guide">naming guide</a>.</p><table><thead><tr><th>When</th><th>Type</th><th>Launch</th><th>Status</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table>`,
      ),
    );
  });

  app.get("/digest", async (_req, res) => {
    const today = londonToday();
    const events = await deps.store.listEvents(digestRange(today));
    res.send(
      page(
        "Digest preview",
        `${nav(deps.calendarUrl)}<h1>Digest preview</h1><p>What Monday's Slack digest would say today, in Slack's formatting.</p><pre>${escapeHtml(buildDigest(events, today, { calendarUrl: deps.calendarUrl }))}</pre>`,
      ),
    );
  });

  app.get("/guide", (_req, res) => {
    res.send(page("Naming guide", `${nav(deps.calendarUrl)}${guideHtml()}`));
  });

  return app;
}
