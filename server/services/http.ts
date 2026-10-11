/** what every upstream client shares: 1 retry on a network blip, a status check, a small cache.
 * a failure here throws a plain Error whose text stays in the server logs, runWidget turns it into a
 * generic "unavailable" for the user, never the upstream body */

import { WidgetError } from "@/server/registry/define";

// every upstream call gives up after this, a stuck service never holds a request or a card
export const UPSTREAM_TIMEOUT_MS = 8000;

// wikimedia and some others ask for a descriptive user agent, it costs nothing to send it everywhere
const USER_AGENT = "EpitechDashboard/1.0 (https://github.com/JadBghiel/dashboard)";

/** a cold first connection sometimes times out (seen in dev: ETIMEDOUT, then fine right after), so
 * 1 retry on a network failure only, never on an http error and never once the caller gave up */
export async function fetchOnceMore(url: URL, init: RequestInit & { signal: AbortSignal }) {
  const withAgent = {
    ...init,
    headers: { "user-agent": USER_AGENT, ...(init.headers as Record<string, string>) },
  };
  try {
    return await fetch(url, withAgent);
  } catch (err) {
    if (init.signal.aborted) throw err;
    return fetch(url, withAgent);
  }
}

export class UpstreamError extends Error {
  constructor(
    readonly what: string,
    readonly status: number,
  ) {
    super(`${what} answered ${status}`);
  }
}

type GetOptions = { signal: AbortSignal; headers?: Record<string, string>; what: string };

/** fetch + status check + json, for the plain keyless upstreams */
export async function getJson(url: URL, { signal, headers, what }: GetOptions): Promise<unknown> {
  const res = await fetchOnceMore(url, {
    signal,
    headers: { accept: "application/json", ...headers },
  });
  if (!res.ok) throw new UpstreamError(what, res.status);
  return res.json();
}

/** same, for xml/rss and anything else read as text */
export async function getText(url: URL, { signal, headers, what }: GetOptions): Promise<string> {
  const res = await fetchOnceMore(url, { signal, headers });
  if (!res.ok) throw new UpstreamError(what, res.status);
  return res.text();
}

/** a small time boxed cache, capped so a flood of random keys cant grow it forever */
export function ttlCache<T>(ttlMs: number, max = 500) {
  const map = new Map<string, { at: number; value: T }>();
  return {
    get(key: string) {
      const hit = map.get(key);
      return hit && Date.now() - hit.at < ttlMs ? hit.value : undefined;
    },
    set(key: string, value: T) {
      if (map.size >= max && !map.has(key)) map.delete(map.keys().next().value!);
      map.set(key, { at: Date.now(), value });
    },
  };
}

/** runs `load` through a ttl cache, and when it fails serves the last value it ever got, flagged
 * stale. the free apis rate limit hard, a slightly old price beats an error. a WidgetError (an
 * unknown ticker, a refused key) is the user's to fix, an old value wouldnt help, it goes through */
export function cachedWithFallback<T>(ttlMs: number) {
  const fresh = ttlCache<T>(ttlMs);
  const lastGood = ttlCache<T>(Number.POSITIVE_INFINITY);
  return async (key: string, load: () => Promise<T>): Promise<{ value: T; stale: boolean }> => {
    const hit = fresh.get(key);
    if (hit !== undefined) return { value: hit, stale: false };
    try {
      const value = await load();
      fresh.set(key, value);
      lastGood.set(key, value);
      return { value, stale: false };
    } catch (err) {
      const last = lastGood.get(key);
      if (last !== undefined && !(err instanceof WidgetError)) return { value: last, stale: true };
      throw err;
    }
  };
}
