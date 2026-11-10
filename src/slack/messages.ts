import { formatRange } from "../time.js";
import type { Change, LaunchEvent, LaunchType } from "../types.js";

export const TYPE_LABEL: Record<LaunchType, string> = {
  public_beta: "Public beta",
  ga: "GA",
  pricing: "Pricing change",
  billing: "Billing change",
  deprecation: "Deprecation",
  marketing_launch: "Marketing launch",
  other: "Other",
};

const TYPE_EMOJI: Record<LaunchType, string> = {
  public_beta: "🧪",
  ga: "🚀",
  pricing: "💰",
  billing: "🧾",
  deprecation: "🌅",
  marketing_launch: "📣",
  other: "📌",
};

export function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function slackLink(url: string, label: string): string {
  return `<${url.replace(/[<>|]/g, "")}|${escapeMrkdwn(label)}>`;
}

/** "🚀 GA" or "🚀 GA + 💰 Pricing" */
export function typeText(event: LaunchEvent): string {
  const base = `${TYPE_EMOJI[event.type]} ${TYPE_LABEL[event.type]}`;
  return event.includesPricing ? `${base} + ${TYPE_EMOJI.pricing} Pricing` : base;
}

/** True when customers start paying with this event. */
export function changesPricing(event: LaunchEvent): boolean {
  return event.type === "pricing" || event.includesPricing;
}

/** "🧪 Public beta · *Mobile replay*" */
export function launchLabel(event: LaunchEvent): string {
  return `${typeText(event)} · *${escapeMrkdwn(event.name)}*`;
}

/** "23–27 Nov (tentative)" or "Tue 24 Nov" */
export function when(event: LaunchEvent): string {
  const range = formatRange(event.startDate, event.endDate);
  return event.status === "tentative" ? `${range} (tentative)` : range;
}

function linksLine(event: LaunchEvent): string | null {
  const links = [
    ...(event.htmlLink ? [slackLink(event.htmlLink, "Calendar")] : []),
    ...event.links.map((l) => slackLink(l.url, l.label)),
  ];
  return links.length ? links.join(" · ") : null;
}

/** How to name the owner in Slack: a mention when we found their user, else their email. */
export function ownerText(email: string | null, slackUserId: string | null): string | null {
  if (slackUserId) return `<@${slackUserId}>`;
  return email ? escapeMrkdwn(email) : null;
}

/** A channel ID renders as a clickable channel. A "#name" stays plain text. */
export function channelText(channel: string | null): string | null {
  if (!channel) return null;
  if (/^[CG][A-Z0-9]+$/.test(channel)) return `<#${channel}>`;
  return escapeMrkdwn(channel);
}

function peopleLine(owner: string | null, event: LaunchEvent): string | null {
  const channel = channelText(event.slackChannel);
  const parts = [
    ...(owner ? [`Owner: ${owner}`] : []),
    ...(channel ? [`Launch channel: ${channel}`] : []),
  ];
  return parts.length ? parts.join(" · ") : null;
}

function headline(change: Change): string {
  switch (change.kind) {
    case "added":
      return `🗓️ New on the launch calendar: ${launchLabel(change.event)}, ${when(change.event)}.`;
    case "confirmed":
      return `✅ Date confirmed: ${launchLabel(change.event)} on ${formatRange(change.event.startDate, change.event.endDate)}. It was tentative for ${formatRange(change.before.startDate, change.before.endDate)}.`;
    case "unconfirmed":
      return `⏸️ Back to tentative: ${launchLabel(change.event)}, now ${formatRange(change.event.startDate, change.event.endDate)}. It was confirmed for ${formatRange(change.before.startDate, change.before.endDate)}.`;
    case "moved":
      return `↪️ Moved: ${launchLabel(change.event)} to ${when(change.event)}. It was ${formatRange(change.before.startDate, change.before.endDate)}.`;
    case "removed":
      return `❌ Removed from the launch calendar: ${launchLabel(change.before)}. It was ${when(change.before)}.`;
  }
}

export function changeOwnerEmail(change: Change): string | null {
  return change.kind === "removed" ? change.before.ownerEmail : change.event.ownerEmail;
}

export function changeMessage(change: Change, owner: string | null): string {
  const event = change.kind === "removed" ? change.before : change.event;
  const lines = [headline(change)];
  const people = peopleLine(owner, event);
  if (people) lines.push(people);
  const links = change.kind === "removed" ? null : linksLine(event);
  if (links) lines.push(links);
  return lines.join("\n");
}

/**
 * Posted in the alert channel, not a DM: launch dates are public at PostHog.
 * `owner` is a mention, so the owner is still notified.
 */
export function reminderMessage(
  event: LaunchEvent,
  owner: string | null,
  guideUrl?: string,
): string {
  const lines = [
    `👋 ${owner ? `${owner}, ` : ""}${launchLabel(event)} is planned for ${formatRange(event.startDate, event.endDate)} and is still tentative on the launch calendar.`,
    "If the date is set, remove [Tentative] from the title and make it a single day. If it's moving, update the dates so everyone sees the change.",
  ];
  if (changesPricing(event)) {
    lines.push(
      "Pricing changes need at least 10 business days' notice for sales before customer emails.",
    );
  }
  const channel = channelText(event.slackChannel);
  if (channel) lines.push(`Launch channel: ${channel}`);
  const links = [linksLine(event), guideUrl ? slackLink(guideUrl, "Naming guide") : null]
    .filter(Boolean)
    .join(" · ");
  if (links) lines.push(links);
  return lines.join("\n");
}
