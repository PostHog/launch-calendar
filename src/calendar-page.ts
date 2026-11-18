import { layoutMonth, monthTitle, shiftMonth, type Segment, type WeekRow } from "./calendar.js";
import { TYPE_EMOJI, TYPE_LABEL } from "./slack/messages.js";
import { formatDay, formatRange } from "./time.js";
import { LAUNCH_TYPES, type LaunchType, type StoredEvent } from "./types.js";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeHref(url: string): string | null {
  return /^https:\/\//i.test(url) ? escapeHtml(url) : null;
}

/** Anything that starts charging takes the pricing color, like on the calendar. */
function colorType(event: StoredEvent): LaunchType {
  return event.includesPricing ? "pricing" : event.type;
}

function typeLabel(event: StoredEvent): string {
  return (TYPE_LABEL[event.type] ?? event.type) + (event.includesPricing ? " + Pricing" : "");
}

function emoji(event: StoredEvent): string {
  return TYPE_EMOJI[event.type] + (event.includesPricing ? TYPE_EMOJI.pricing : "");
}

function describe(event: StoredEvent): string {
  const when = formatRange(event.startDate, event.endDate);
  const status = event.status === "tentative" ? `${when}, tentative` : when;
  const owner = event.ownerEmail ? ` · Owner: ${event.ownerEmail}` : "";
  const summary = event.summary ? ` · ${event.summary}` : "";
  return `${typeLabel(event)} · ${event.name} · ${status}${owner}${summary}`;
}

function eventLink(event: StoredEvent, inner: string, attrs: string): string {
  const href = event.htmlLink ? safeHref(event.htmlLink) : null;
  const label = escapeHtml(describe(event));
  return href
    ? `<a ${attrs} href="${href}" title="${label}" aria-label="${label}">${inner}</a>`
    : `<span ${attrs} title="${label}">${inner}</span>`;
}

function bar(segment: Segment): string {
  const { event } = segment;
  const classes = [
    "ev",
    `t-${colorType(event)}`,
    event.status === "tentative" ? "tentative" : "",
    segment.continuesBefore ? "cont-before" : "",
    segment.continuesAfter ? "cont-after" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const style = `grid-column:${segment.startCol} / span ${segment.span};grid-row:${segment.lane + 2}`;
  const inner = `<span class="ev-emoji" aria-hidden="true">${emoji(event)}</span><span class="ev-name">${escapeHtml(event.name)}</span>`;
  return eventLink(event, inner, `class="${classes}" style="${style}"`);
}

function weekRow(row: WeekRow, month: string, today: string): string {
  const days = row.days
    .map((day, i) => {
      const classes = [
        "day",
        day.slice(0, 7) !== month ? "outside" : "",
        i >= 5 ? "weekend" : "",
        day === today ? "today" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const label = escapeHtml(formatDay(day));
      return `<div class="${classes}" style="grid-column:${i + 1}"><span class="num" title="${label}">${Number(day.slice(8))}</span></div>`;
    })
    .join("");
  const rows = `grid-template-rows:30px repeat(${row.lanes}, 26px) minmax(12px, 1fr)`;
  return `<div class="week" style="${rows}">${days}${row.segments.map(bar).join("")}</div>`;
}

function agenda(events: StoredEvent[], month: string): string {
  const inMonth = events.filter(
    (e) => e.endDate.slice(0, 7) >= month && e.startDate.slice(0, 7) <= month,
  );
  if (inMonth.length === 0)
    return `<ul class="agenda card"><li class="empty">Nothing on the launch calendar this month.</li></ul>`;
  const items = inMonth
    .map((event) => {
      const when = escapeHtml(formatRange(event.startDate, event.endDate));
      const tentative = event.status === "tentative" ? ` <span class="tag">tentative</span>` : "";
      const inner = `<span class="swatch t-${colorType(event)}${event.status === "tentative" ? " tentative" : ""}"></span><span class="a-when">${when}</span><span class="a-name">${emoji(event)} ${escapeHtml(event.name)}${tentative}${event.summary ? `<span class="a-summary">${escapeHtml(event.summary)}</span>` : ""}</span>`;
      return `<li>${eventLink(event, inner, `class="a-item"`)}</li>`;
    })
    .join("");
  return `<ul class="agenda card">${items}</ul>`;
}

function legend(): string {
  const chips = LAUNCH_TYPES.map(
    (type) =>
      `<span class="chip"><span class="swatch t-${type}"></span>${escapeHtml(TYPE_LABEL[type])}</span>`,
  ).join("");
  return `<div class="legend">${chips}<span class="chip"><span class="swatch t-other tentative"></span>Striped: tentative</span></div>`;
}

export function calendarSection(events: StoredEvent[], month: string, today: string): string {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const short = (m: string) => monthTitle(m).split(" ")[0]?.slice(0, 3) ?? m;
  const nav = `<div class="cal-nav"><a class="btn" href="/?month=${prev}" aria-label="Previous month">‹ ${short(prev)}</a><a class="btn" href="/">Today</a><a class="btn" href="/?month=${next}" aria-label="Next month">${short(next)} ›</a></div>`;
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((d) => `<div>${d}</div>`)
    .join("");
  const weeks = layoutMonth(month, events)
    .map((row) => weekRow(row, month, today))
    .join("");
  return `<div class="cal-head"><h1>${escapeHtml(monthTitle(month))}</h1>${nav}</div>
${legend()}
<div class="cal card" role="grid" aria-label="${escapeHtml(monthTitle(month))}"><div class="weekdays">${weekdays}</div>${weeks}</div>
${agenda(events, month)}`;
}

export const CALENDAR_CSS = `
.cal-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:4px}
.cal-nav{display:flex;gap:6px}
.legend{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 14px}
.chip{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 8px;font-size:var(--text-xs);color:var(--muted-foreground);background:var(--card);border-radius:var(--radius-xs);box-shadow:0 0 0 1px color-mix(in oklab,var(--foreground) 10%,transparent)}
.swatch{display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--c);flex:none}
/* Google Calendar's own colors, as the naming guide assigns them: Grape, Basil, Tangerine, Banana, Graphite, Flamingo, Peacock. */
.t-public_beta{--c:#8e24aa}.t-ga{--c:#0b8043}.t-pricing{--c:#f4511e}.t-billing{--c:#f6bf26;--ink:#3a2c00}
.t-deprecation{--c:#616161}.t-marketing_launch{--c:#e67c73}.t-other{--c:#039be5}
.tentative.swatch,.ev.tentative{background:repeating-linear-gradient(135deg,color-mix(in oklab,var(--c) 34%,var(--card)) 0 5px,color-mix(in oklab,var(--c) 16%,var(--card)) 5px 10px);box-shadow:inset 0 0 0 1px var(--c)}
.weekdays{display:grid;grid-template-columns:repeat(7,1fr);font-size:var(--text-xs);color:var(--muted-foreground);font-weight:500;background:color-mix(in oklab,var(--muted) 60%,transparent);border-bottom:1px solid var(--border)}
.weekdays div{padding:6px 10px}
.week{display:grid;grid-template-columns:repeat(7,1fr);row-gap:3px;min-height:104px;border-top:1px solid var(--border)}
.week:first-of-type{border-top:0}
.day{grid-row:1 / -1;border-left:1px solid var(--border);padding:4px 6px}
.day:first-child{border-left:0}
.day.weekend{background:color-mix(in oklab,var(--muted) 70%,transparent)}
.day.outside .num{color:var(--muted-foreground);opacity:.55}
.num{display:inline-grid;place-items:center;min-width:24px;height:24px;padding:0 4px;border-radius:12px;font-size:var(--text-xs);font-weight:500;font-variant-numeric:tabular-nums}
.day.today .num{background:var(--primary);color:var(--primary-foreground);font-weight:600}
.ev{position:relative;z-index:1;margin:0 4px;padding:0 8px;border-radius:var(--radius-sm);background:var(--c);color:var(--ink,#fff);font-size:var(--text-xs);font-weight:500;line-height:26px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none;min-width:0}
.ev.tentative{color:var(--foreground)}
.ev:hover{filter:brightness(1.06);outline:2px solid color-mix(in oklab,var(--c) 60%,transparent);outline-offset:1px}
.ev:focus-visible{outline:2px solid var(--ring);outline-offset:1px}
.ev.cont-before{margin-left:0;border-top-left-radius:0;border-bottom-left-radius:0}
.ev.cont-after{margin-right:0;border-top-right-radius:0;border-bottom-right-radius:0}
.ev-emoji{margin-right:5px}
.agenda{display:none;list-style:none;padding:0;margin:0}
.agenda li{border-bottom:1px solid var(--border)}
.agenda li:last-child{border-bottom:0}
.a-item{display:grid;grid-template-columns:10px 92px 1fr;gap:10px;align-items:center;padding:10px 12px;text-decoration:none}
.a-when{color:var(--muted-foreground);font-size:var(--text-xs);font-variant-numeric:tabular-nums}
.tag{font-size:var(--text-xxs);color:var(--muted-foreground);background:var(--muted);border-radius:var(--radius-xs);padding:1px 5px;margin-left:4px;vertical-align:1px}
.a-summary{display:block;color:var(--muted-foreground);font-size:var(--text-xs);line-height:1.4;margin-top:2px}
.agenda .empty{color:var(--muted-foreground);padding:10px 12px}
@media (max-width:720px){.cal{display:none}.agenda{display:block}}
`;
