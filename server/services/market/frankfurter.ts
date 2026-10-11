/** frankfurter, the european central bank reference rates, no key. the ecb publishes once a
 * working day, so an hour of cache loses nothing */

import { z } from "zod";

import { WidgetError } from "@/server/registry/define";

import { getJson, ttlCache, UpstreamError } from "../http";

const BASE_URL = "https://api.frankfurter.dev/v1";

// the ~30 currencies the ecb quotes. hard coded on purpose: its the list the upstream accepts, it
// barely moves, and a wrong code is caught before any call
// prettier-ignore
export const CURRENCIES = [
  "AUD", "BGN", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "IDR", "ILS",
  "INR", "ISK", "JPY", "KRW", "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB",
  "TRY", "USD", "ZAR",
] as const;

const LatestResponse = z.object({
  base: z.string(),
  date: z.string(),
  rates: z.record(z.string(), z.number()),
});

export type Rates = { base: string; date: string; rates: Record<string, number> };

const cache = ttlCache<Rates>(60 * 60_000);

export async function latestRates(from: string, to: string[], signal: AbortSignal) {
  const bad = [from, ...to].find((c) => !(CURRENCIES as readonly string[]).includes(c));
  if (bad) throw new WidgetError(`${bad} isn't a currency the ECB publishes.`);

  const key = `${from}|${to.join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url = new URL(`${BASE_URL}/latest`);
  url.searchParams.set("from", from);
  // asking for the base itself is an error for frankfurter, its rate is 1 anyway
  const others = to.filter((c) => c !== from);
  if (others.length > 0) url.searchParams.set("to", others.join(","));

  try {
    const parsed = LatestResponse.parse(await getJson(url, { signal, what: "frankfurter" }));
    const result = { base: parsed.base, date: parsed.date, rates: { ...parsed.rates, [from]: 1 } };
    cache.set(key, result);
    return result;
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      throw new WidgetError("One of these currencies isn't available.");
    }
    throw err;
  }
}
