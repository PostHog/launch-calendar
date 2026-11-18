import express, { type Express } from "express";
import { parseMonth, gridRange } from "./calendar.js";
import { CALENDAR_CSS, calendarSection, escapeHtml, safeHref } from "./calendar-page.js";
import { buildDigest, digestRange } from "./digest.js";
import { PAGE_CSS, QUILL_TOKENS } from "./styles.js";
import { guideHtml } from "./guide.js";
import { TYPE_LABEL } from "./slack/messages.js";
import type { Store } from "./store/store.js";
import { formatRange, londonToday } from "./time.js";
import type { StoredEvent } from "./types.js";

function row(event: StoredEvent): string {
  const href = event.htmlLink ? safeHref(event.htmlLink) : null;
  const name = href ? `<a href="${href}">${escapeHtml(event.name)}</a>` : escapeHtml(event.name);
  const summary = event.summary
    ? `<div class="muted" style="font-size:var(--text-xs)">${escapeHtml(event.summary)}</div>`
    : "";
  return `<tr class="${event.status}"><td>${escapeHtml(formatRange(event.startDate, event.endDate))}</td><td>${escapeHtml((TYPE_LABEL[event.type] ?? event.type) + (event.includesPricing ? " + Pricing" : ""))}</td><td>${name}${summary}</td><td>${escapeHtml(event.status)}</td><td>${escapeHtml(event.ownerEmail ?? "")}</td></tr>`;
}

function page(title: string, body: string, wide = false): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
${QUILL_TOKENS}
${PAGE_CSS}
.wrap{max-width:${wide ? 1180 : 960}px}
${wide ? CALENDAR_CSS : ""}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

function nav(calendarUrl: string | undefined, current: "/" | "/guide" | "/digest"): string {
  const item = (href: string, label: string) =>
    `<a href="${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a>`;
  const links = [
    item("/", "Calendar"),
    item("/guide", "Naming guide"),
    item("/digest", "Digest preview"),
  ];
  const href = calendarUrl ? safeHref(calendarUrl) : null;
  if (href) links.push(`<a href="${href}">Open in Google Calendar ↗</a>`);
  return `<nav class="topnav" aria-label="Launch calendar">${links.join("")}</nav>`;
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

  app.get("/", async (req, res) => {
    const today = londonToday();
    const month = parseMonth(req.query.month, today);
    const monthEvents = await deps.store.listEvents(gridRange(month));
    const upcoming = await deps.store.listEvents(digestRange(today));
    const rows = upcoming.length
      ? upcoming.map(row).join("")
      : `<tr><td colspan="5">Nothing upcoming on the launch calendar.</td></tr>`;
    res.send(
      page(
        "Launch calendar",
        `${nav(deps.calendarUrl, "/")}${calendarSection(monthEvents, month, today)}
<h2>Coming up</h2><p class="muted">Every upcoming launch and pricing change. Tentative dates are greyed out. Adding one? Read the <a href="/guide">naming guide</a>.</p>
<div class="card table-card"><table><thead><tr><th>When</th><th>Type</th><th>Launch</th><th>Status</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table></div>`,
        true,
      ),
    );
  });

  app.get("/digest", async (_req, res) => {
    const today = londonToday();
    const events = await deps.store.listEvents(digestRange(today));
    res.send(
      page(
        "Digest preview",
        `${nav(deps.calendarUrl, "/digest")}<h1>Digest preview</h1><p class="muted">What Monday's Slack digest would say today, in Slack's formatting.</p><pre>${escapeHtml(buildDigest(events, today, { calendarUrl: deps.calendarUrl }))}</pre>`,
      ),
    );
  });

  app.get("/guide", (_req, res) => {
    res.send(
      page(
        "Naming guide",
        `${nav(deps.calendarUrl, "/guide")}<article class="prose">${guideHtml()}</article>`,
      ),
    );
  });

  return app;
}
