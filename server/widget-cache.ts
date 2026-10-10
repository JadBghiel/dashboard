/** the cache in front of every widget fetch, ttl from the widget's own declaration:
 * 1. memory: this server copy, no round trip
 * 2. the CachedResponse table: shared by every server copy, so on vercel 2 copies dont both call
 *    the upstream, and it survives a cold start
 * 3. in flight: 2 identical requests at the same moment share 1 upstream call
 * an expired row is kept on purpose: when the upstream is down, the last good answer is served,
 * flagged stale, instead of an error */

import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

type Entry = { payload: unknown; expiresAt: number };

const MEMORY_MAX = 1000;
const memory = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();

/** the key: the widget plus everything its answer depends on, hashed so it stays short */
export function cacheKey(widget: string, parts: unknown) {
  const hash = createHash("sha256").update(JSON.stringify(parts)).digest("base64url");
  return `w:${widget}:${hash.slice(0, 32)}`;
}

function remember(key: string, entry: Entry) {
  // oldest first out, a flood of random params cant grow it forever
  if (memory.size >= MEMORY_MAX && !memory.has(key)) memory.delete(memory.keys().next().value!);
  memory.set(key, entry);
}

export type Cached = { payload: unknown; stale: boolean };

/** `load` runs only on a miss. `isLoadFailure` says which errors may fall back to a stale answer:
 * an upstream outage yes, a user error like an unknown city no */
export async function cached(
  key: string,
  ttlSec: number,
  load: () => Promise<unknown>,
  isLoadFailure: (err: unknown) => boolean,
): Promise<Cached> {
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && hit.expiresAt > now) return { payload: hit.payload, stale: false };

  const row = await db.cachedResponse.findUnique({ where: { key } }).catch(() => null);
  if (row && row.expiresAt.getTime() > now) {
    remember(key, { payload: row.payload, expiresAt: row.expiresAt.getTime() });
    return { payload: row.payload, stale: false };
  }

  let pending = inFlight.get(key);
  if (!pending) {
    pending = load().finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  try {
    const payload = await pending;
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    remember(key, { payload, expiresAt: expiresAt.getTime() });
    const json = payload as Prisma.InputJsonValue;
    // a failed write only costs a refetch later, the user still gets their answer
    await db.cachedResponse
      .upsert({
        where: { key },
        create: { key, payload: json, expiresAt },
        update: { payload: json, expiresAt },
      })
      .catch((err) => console.error("widget cache write failed", err));
    return { payload, stale: false };
  } catch (err) {
    const last = hit ?? row;
    if (last && isLoadFailure(err)) return { payload: last.payload, stale: true };
    throw err;
  }
}

/** tests start each case from an empty cache */
export function clearMemoryCache() {
  memory.clear();
  inFlight.clear();
}
