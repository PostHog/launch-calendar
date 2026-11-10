import type { Change, LaunchEvent } from "./types.js";

/**
 * What changed for one event, or null when nothing people need to hear about changed.
 * Renames, type changes and new links are left out on purpose: only dates and status move plans.
 */
export function diffEvent(
  before: LaunchEvent | undefined,
  after: LaunchEvent | undefined,
): Change | null {
  if (!before && after) return { kind: "added", event: after };
  if (before && !after) return { kind: "removed", before };
  if (!before || !after) return null;

  const datesChanged = before.startDate !== after.startDate || before.endDate !== after.endDate;
  if (before.status === "tentative" && after.status === "confirmed") {
    return { kind: "confirmed", event: after, before };
  }
  if (before.status === "confirmed" && after.status === "tentative") {
    return { kind: "unconfirmed", event: after, before };
  }
  if (datesChanged) return { kind: "moved", event: after, before };
  return null;
}

/** Edits to launches that are already over don't need an alert. */
export function isWorthPosting(change: Change, today: string): boolean {
  const latestEnd =
    change.kind === "removed"
      ? change.before.endDate
      : change.kind === "added"
        ? change.event.endDate
        : change.event.endDate > change.before.endDate
          ? change.event.endDate
          : change.before.endDate;
  return latestEnd >= today;
}
