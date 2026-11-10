import { runDigestTick, type DigestResult } from "./digest.js";
import type { CalendarSource } from "./google/calendar.js";
import { errorFields, log } from "./log.js";
import { runReminders } from "./reminders.js";
import type { Poster } from "./slack/client.js";
import { changeMessage, changeOwnerEmail, ownerText } from "./slack/messages.js";
import type { Store } from "./store/store.js";
import { syncCalendar } from "./sync.js";
import { londonToday } from "./time.js";

export interface RunnerDeps {
  store: Store;
  source: CalendarSource | undefined;
  poster: Poster;
  calendarId: string | undefined;
  channelId: string | undefined;
  calendarUrl?: string;
  /** The app's /guide page, linked from reminders and the digest. */
  guideUrl?: string;
  /** Where the digest's "How it works" link goes, e.g. the handbook page. Defaults to guideUrl. */
  howItWorksUrl?: string;
}

export interface TickResult {
  /** "off" when Google credentials or the calendar ID are missing. */
  sync: "ok" | "off" | "failed";
  syncError?: string;
  changesPosted: number;
  changesFound: number;
  baseline: boolean;
  reminders: number;
  digest: DigestResult;
}

/** One pass: sync the calendar, post changes, send reminders, post the digest when it's due. */
export async function runTick(deps: RunnerDeps, now: Date = new Date()): Promise<TickResult> {
  const today = londonToday(now);
  const result: TickResult = {
    sync: "off",
    changesPosted: 0,
    changesFound: 0,
    baseline: false,
    reminders: 0,
    digest: "not_time",
  };

  if (deps.source && deps.calendarId) {
    try {
      const sync = await syncCalendar(
        { store: deps.store, source: deps.source },
        deps.calendarId,
        today,
      );
      result.sync = "ok";
      result.baseline = sync.baseline;
      result.changesFound = sync.changes.length;
      if (sync.baseline)
        log.info("first sync recorded a baseline, nothing posted", { fetched: sync.fetched });
      for (const change of sync.changes) {
        if (!deps.channelId) break;
        const email = changeOwnerEmail(change);
        const userId = email ? await deps.poster.userIdByEmail(email) : null;
        const { posted } = await deps.poster.post(
          deps.channelId,
          changeMessage(change, ownerText(email, userId)),
        );
        if (posted) result.changesPosted++;
      }
    } catch (err) {
      result.sync = "failed";
      result.syncError = err instanceof Error ? err.message : String(err);
      log.error("sync failed", errorFields(err));
    }
  }

  try {
    result.reminders = await runReminders(deps, today);
  } catch (err) {
    log.error("reminders failed", errorFields(err));
  }

  result.digest = await runDigestTick(deps, now);
  return result;
}

/** Runs a tick now and then every `intervalMs`, never two at once. */
export function startRunner(deps: RunnerDeps, intervalMs: number): () => void {
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    runTick(deps)
      .then((r) => {
        if (r.changesFound || r.reminders || r.digest === "posted") log.info("tick", { ...r });
      })
      .catch((err: unknown) => log.error("tick failed", errorFields(err)))
      .finally(() => {
        running = false;
      });
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
}
