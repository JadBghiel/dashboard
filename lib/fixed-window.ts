/** a fixed window counter per key, in memory: n hits allowed per window, then refused until it
 * resets. the api rate limit (server/rate-limit.ts) and the per account log in limit (lib/auth.ts)
 * both count w/ it. each server copy counts on its own, a guard against abuse, not an exact quota */

export function fixedWindow(max: number, windowSec: number, maxKeys = 10_000) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  // expired windows go 1st, then the oldest, so a flood of new keys cant reset everyone's count
  function makeRoom(now: number) {
    for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
    while (windows.size >= maxKeys) windows.delete(windows.keys().next().value!);
  }

  /** counts 1 hit, retryAfter = the seconds until the window resets, 0 = allowed */
  return function hit(key: string): { retryAfter: number } {
    const now = Date.now();
    let w = windows.get(key);
    if (!w || w.resetAt <= now) {
      windows.delete(key);
      if (windows.size >= maxKeys) makeRoom(now);
      w = { count: 0, resetAt: now + windowSec * 1000 };
      windows.set(key, w);
    }
    w.count++;
    return { retryAfter: w.count > max ? Math.ceil((w.resetAt - now) / 1000) : 0 };
  };
}
