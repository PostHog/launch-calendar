import { monthTitle } from "./calendar.js";
import { colorType, emoji, escapeHtml, safeHref, typeLabel } from "./calendar-page.js";
import { changesPricing } from "./slack/messages.js";
import { formatRange } from "./time.js";
import type { StoredEvent } from "./types.js";

/** Google Calendar event IDs are base32hex; anything else can't be one. */
export function isEventId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,1024}$/.test(id);
}

function channelHtml(channel: string): string {
  if (/^[CG][A-Z0-9]+$/.test(channel))
    return `<a href="https://slack.com/app_redirect?channel=${channel}">Open in Slack ↗</a>`;
  return escapeHtml(channel);
}

function row(label: string, value: string): string {
  return `<dt>${label}</dt><dd>${value}</dd>`;
}

/** The body of one launch's page: everything the calendar knows about it. */
export function launchDetails(event: StoredEvent): string {
  const tentative = event.status === "tentative";
  const month = event.startDate.slice(0, 7);
  const rows = [
    row("When", escapeHtml(formatRange(event.startDate, event.endDate))),
    row(
      "Status",
      tentative ? `Tentative <span class="muted">· The dates can still move.</span>` : "Confirmed",
    ),
    row("Type", escapeHtml(typeLabel(event))),
  ];
  if (event.ownerEmail)
    rows.push(
      row(
        "Owner",
        `<a href="mailto:${escapeHtml(event.ownerEmail)}">${escapeHtml(event.ownerEmail)}</a>`,
      ),
    );
  if (event.slackChannel) rows.push(row("Launch channel", channelHtml(event.slackChannel)));
  const links = event.links
    .map((link) => {
      const href = safeHref(link.url);
      return href ? `<li><a href="${href}">${escapeHtml(link.label)} ↗</a></li>` : "";
    })
    .filter(Boolean);
  if (links.length) rows.push(row("Links", `<ul>${links.join("")}</ul>`));

  const pricing = changesPricing(event)
    ? `<p class="note">💰 Pricing changes need at least 10 business days' notice for sales before customer emails.</p>`
    : "";
  const edit = event.htmlLink ? safeHref(event.htmlLink) : null;

  return `<a class="back" href="/?month=${month}">‹ ${escapeHtml(monthTitle(month))}</a>
<div class="launch-kind"><span class="swatch t-${colorType(event)}${tentative ? " tentative" : ""}"></span>${emoji(event)} ${escapeHtml(typeLabel(event))}${tentative ? ` <span class="tag">tentative</span>` : ""}</div>
<h1>${escapeHtml(event.name)}</h1>
${event.summary ? `<p class="lead">${escapeHtml(event.summary)}</p>` : ""}
<div class="card details"><dl>${rows.join("")}</dl></div>
${pricing}
${edit ? `<p><a class="btn" href="${edit}">Edit in Google Calendar ↗</a></p>` : ""}`;
}

export function launchNotFound(): string {
  return `<a class="back" href="/">‹ Calendar</a><h1>Launch not found</h1><p class="muted">It may have been removed from the launch calendar.</p>`;
}

export const LAUNCH_CSS = `
.back{display:inline-block;margin:4px 0 12px;font-size:var(--text-ui);color:var(--muted-foreground);text-decoration:none}
.back:hover{color:var(--foreground)}
.launch-kind{display:flex;align-items:center;gap:8px;font-size:var(--text-ui);color:var(--muted-foreground)}
.lead{font-size:var(--text-base);max-width:680px;margin:4px 0 20px}
.details dl{display:grid;grid-template-columns:140px 1fr;margin:0}
.details dt,.details dd{margin:0;padding:10px 14px;border-bottom:1px solid var(--border)}
.details dt{color:var(--muted-foreground);font-weight:500}
.details dl > :nth-last-child(-n+2){border-bottom:0}
.details ul{list-style:none;margin:0;padding:0}
.note{margin:16px 0 0;padding:10px 14px;border-radius:var(--radius-md);background:color-mix(in oklab,#f4511e 12%,var(--card));box-shadow:inset 0 0 0 1px color-mix(in oklab,#f4511e 35%,transparent)}
@media (max-width:560px){.details dl{grid-template-columns:1fr}.details dt{border-bottom:0;padding-bottom:0}}
`;
