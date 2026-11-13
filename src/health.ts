/** Failed syncs in a row before the maintainer hears about it: 15 minutes at the default interval. */
export const FAILURES_BEFORE_ALERT = 3;

/**
 * Tracks failed syncs so a broken Google sign-in doesn't just make the app go quiet.
 * Kept in memory: a restart starts the count again, which at worst delays one alert.
 */
export class SyncHealth {
  private failures = 0;
  private alerted = false;
  private lastError = "";

  /** True when this failure should alert: the third in a row, and no alert sent yet. */
  failed(error: string): boolean {
    this.failures++;
    this.lastError = error;
    return this.failures >= FAILURES_BEFORE_ALERT && !this.alerted;
  }

  /** Call once the failure alert was actually posted, so it isn't repeated every tick. */
  markAlerted(): void {
    this.alerted = true;
  }

  /** True when this success ends an outage we alerted about. */
  succeeded(): boolean {
    const recovered = this.alerted;
    this.failures = 0;
    this.alerted = false;
    return recovered;
  }

  get failureCount(): number {
    return this.failures;
  }

  get error(): string {
    return this.lastError;
  }
}
