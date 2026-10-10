/** the dashboard's 1 timer: every widget registers its refresh and its rate, a tick every second runs
 * whatever is due. no react in here so the tests drive it w/ fake time */

type Job = { run: () => void; everyMs: number; nextAt: number };

// the 1st run gets up to 10% of the rate (30s max) on top, so widgets added together dont fire in
// lockstep forever
const MAX_JITTER_MS = 30_000;

export class Schedule {
  private jobs = new Map<string, Job>();
  private paused = false;

  constructor(
    private now: () => number = Date.now,
    private random: () => number = Math.random,
  ) {}

  /** returns the unregister function, call it when the widget goes away */
  add(id: string, run: () => void, everySec: number) {
    const everyMs = everySec * 1000;
    const jitter = Math.min(everyMs * 0.1, MAX_JITTER_MS) * this.random();
    this.jobs.set(id, { run, everyMs, nextAt: this.now() + everyMs + jitter });
    return () => {
      this.jobs.delete(id);
    };
  }

  /** a manual refresh restarts that widget's countdown */
  reset(id: string) {
    const job = this.jobs.get(id);
    if (job) job.nextAt = this.now() + job.everyMs;
  }

  tick() {
    if (this.paused) return;
    const now = this.now();
    for (const job of this.jobs.values()) {
      if (job.nextAt > now) continue;
      job.nextAt = now + job.everyMs;
      job.run();
    }
  }

  /** the tab is hidden, nothing runs */
  pause() {
    this.paused = true;
  }

  /** the tab is back: every widget that came due while hidden refreshes once, spread over spreadMs
   * so they dont all hit the server at the same instant. returns what to run and when, the caller
   * owns the timeouts */
  resume(spreadMs = 3000) {
    this.paused = false;
    const now = this.now();
    const overdue = [...this.jobs.values()].filter((job) => job.nextAt <= now);
    return overdue.map((job, i) => {
      job.nextAt = now + job.everyMs;
      const delayMs = overdue.length > 1 ? Math.round((spreadMs * i) / (overdue.length - 1)) : 0;
      return { run: job.run, delayMs };
    });
  }
}
