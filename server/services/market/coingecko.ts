/** coingecko, crypto prices w/o a key. the keyless tier allows roughly 10 calls/min shared by every
 * user of the app, so a price is good for 60s and a failed call serves the last one, flagged stale */

import { z } from "zod";

import { cachedWithFallback, getJson, ttlCache } from "../http";

const MARKETS_URL = "https://api.coingecko.com/api/v3/coins/markets";

const MarketsResponse = z.array(
  z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    current_price: z.number().nullable(),
    price_change_percentage_24h: z.number().nullable(),
  }),
);

/** https only, and w/o coingecko's "?1696501400" version stamp: next's image optimizer only takes
 * logo urls w/o a query string (next.config.ts), the cdn serves the same file w/o it */
function imageUrl(url: string | null | undefined) {
  if (!url?.startsWith("https://")) return null;
  return url.split("?")[0];
}

export type Coin = {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price: number;
  changePct: number;
};

const markets = cachedWithFallback<Coin[]>(60_000);

/** unknown ids are simply absent from the answer, the order is the one asked for */
export async function coinPrices(ids: string[], currency: string, signal: AbortSignal) {
  const key = `${currency}|${ids.join(",")}`;
  return markets(key, async () => {
    const url = new URL(MARKETS_URL);
    url.searchParams.set("vs_currency", currency);
    url.searchParams.set("ids", ids.join(","));
    const rows = MarketsResponse.parse(await getJson(url, { signal, what: "coingecko" }));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const r = byId.get(id);
      if (!r || r.current_price === null) return [];
      return [
        {
          id: r.id,
          symbol: r.symbol.toUpperCase(),
          name: r.name,
          // only https, the page loads them straight from coingecko's cdn
          image: imageUrl(r.image),
          price: r.current_price,
          changePct: r.price_change_percentage_24h ?? 0,
        },
      ];
    });
  });
}

// ---- search ----

const SearchResponse = z.object({
  coins: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      symbol: z.string(),
      thumb: z.string().nullable().optional(),
    }),
  ),
});

export type CoinMatch = { id: string; name: string; symbol: string; image: string | null };

const searchCache = ttlCache<CoinMatch[]>(10 * 60_000);

/** by name or symbol, the most traded first (coingecko's own order) */
export async function searchCoins(q: string, signal: AbortSignal): Promise<CoinMatch[]> {
  const key = q.toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return hit;
  const url = new URL("https://api.coingecko.com/api/v3/search");
  url.searchParams.set("query", q);
  const { coins } = SearchResponse.parse(await getJson(url, { signal, what: "coingecko" }));
  const matches = coins.slice(0, 8).map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol.toUpperCase(),
    image: imageUrl(c.thumb),
  }));
  searchCache.set(key, matches);
  return matches;
}
