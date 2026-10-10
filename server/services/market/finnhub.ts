/** finnhub, the market data upstream. the user's own key if they saved one, else 1 key for the whole
 * app (FINNHUB_API_KEY), sent in a header so
 * it never ends up in a logged url. the free plan is 60 calls/min shared by every user, hence the
 * caches: a quote is good for 60s, a company profile for a day */

import { z } from "zod";

import { WidgetError } from "@/server/registry/define";

import { fetchOnceMore, ttlCache, UpstreamError } from "../http";

const BASE_URL = "https://finnhub.io/api/v1";

/** finnhub answers all zeros for a symbol it doesnt know. a WidgetError so the user sees it, its own
 * class so the watchlist can skip 1 dead ticker instead of failing the whole list */
export class UnknownTickerError extends WidgetError {
  constructor(symbol: string) {
    super(`No ticker called ${symbol}.`);
  }
}

async function getJson(
  path: string,
  query: Record<string, string>,
  signal: AbortSignal,
  ownKey?: string,
) {
  const key = ownKey ?? process.env.FINNHUB_API_KEY;
  if (!key) throw new WidgetError("Market data isn't configured on this server.");

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetchOnceMore(url, {
    signal,
    headers: { accept: "application/json", "X-Finnhub-Token": key },
  });
  // 403 is the free plan saying no, in practice a non us listing
  if (res.status === 403) throw new WidgetError("Only US listed tickers are available.");
  if (!res.ok) throw new UpstreamError("finnhub", res.status);
  return res.json();
}

// ---- search ----

export type SymbolMatch = { symbol: string; name: string };

const SearchResponse = z.object({
  result: z.array(z.object({ symbol: z.string(), description: z.string() })),
});

const searchCache = ttlCache<SymbolMatch[]>(10 * 60_000);

export async function searchSymbols(q: string, signal: AbortSignal): Promise<SymbolMatch[]> {
  const key = q.toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return hit;

  // the free plan only quotes us listings, so search asks for those only. a guess on the symbol
  // suffix doesnt work: tokyo's .T looks like a us share class (BRK.B)
  const { result } = SearchResponse.parse(await getJson("/search", { q, exchange: "US" }, signal));
  const seen = new Set<string>();
  const matches = result
    .filter((r) => !seen.has(r.symbol) && seen.add(r.symbol))
    .slice(0, 8)
    .map((r) => ({ symbol: r.symbol, name: r.description }));

  searchCache.set(key, matches);
  return matches;
}

// ---- quote ----

export type Quote = {
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  // unix seconds of the last trade
  time: number;
  // true when finnhub failed and this is the last price we got (#30)
  stale: boolean;
};

const QuoteResponse = z.object({
  c: z.number(),
  d: z.number().nullable(),
  dp: z.number().nullable(),
  h: z.number(),
  l: z.number(),
  o: z.number(),
  pc: z.number(),
  t: z.number(),
});

const quoteCache = ttlCache<Quote>(60_000);
// never expires on purpose: the whole point is to still have something when finnhub is down
const lastGood = new Map<string, Quote>();

// prices arent personal, so the caches are shared whichever key fetched them
export async function quote(symbol: string, signal: AbortSignal, ownKey?: string): Promise<Quote> {
  const hit = quoteCache.get(symbol);
  if (hit) return hit;

  try {
    const q = QuoteResponse.parse(await getJson("/quote", { symbol }, signal, ownKey));
    // an unknown symbol isnt an error for finnhub, it answers all zeros
    if (q.t === 0 && q.c === 0) throw new UnknownTickerError(symbol);

    const fresh: Quote = {
      price: q.c,
      change: q.d ?? 0,
      changePct: q.dp ?? 0,
      open: q.o,
      high: q.h,
      low: q.l,
      prevClose: q.pc,
      time: q.t,
      stale: false,
    };
    quoteCache.set(symbol, fresh);
    if (lastGood.size >= 500 && !lastGood.has(symbol))
      lastGood.delete(lastGood.keys().next().value!);
    lastGood.set(symbol, fresh);
    return fresh;
  } catch (err) {
    // an unknown ticker or a missing key is the user's to fix, a stale price wouldnt help
    if (err instanceof WidgetError) throw err;
    const last = lastGood.get(symbol);
    if (last) return { ...last, stale: true };
    throw err;
  }
}

// ---- company profile ----

export type Profile = {
  name: string;
  logo: string | null;
  // short code google finance understands: NASDAQ, NYSE, NYSEARCA, NYSEAMERICAN
  exchange: string | null;
  currency: string;
};

const ProfileResponse = z.object({
  name: z.string().optional(),
  logo: z.string().optional(),
  exchange: z.string().optional(),
  currency: z.string().optional(),
});

function shortExchange(exchange = ""): string | null {
  const e = exchange.toUpperCase();
  if (e.startsWith("NASDAQ")) return "NASDAQ";
  if (e.includes("ARCA")) return "NYSEARCA";
  if (e.includes("AMERICAN") || e.includes("NYSE MKT")) return "NYSEAMERICAN";
  if (e.includes("NEW YORK STOCK EXCHANGE") || e.startsWith("NYSE")) return "NYSE";
  return null;
}

// a company name and logo dont change, a day is plenty
const profileCache = ttlCache<Profile>(24 * 60 * 60_000);

/** cosmetic only: if finnhub fails here the card still shows the ticker w/o a logo, never an error */
export async function profile(
  symbol: string,
  signal: AbortSignal,
  ownKey?: string,
): Promise<Profile> {
  const hit = profileCache.get(symbol);
  if (hit) return hit;

  const fallback: Profile = { name: symbol, logo: null, exchange: null, currency: "USD" };
  try {
    const p = ProfileResponse.parse(await getJson("/stock/profile2", { symbol }, signal, ownKey));
    const result: Profile = {
      name: p.name || symbol,
      // only https logos, the page loads them straight from finnhub's cdn
      logo: p.logo?.startsWith("https://") ? p.logo : null,
      exchange: shortExchange(p.exchange),
      currency: p.currency || "USD",
    };
    profileCache.set(symbol, result);
    return result;
  } catch {
    return fallback;
  }
}

// symbols are validated against [A-Z0-9.-] before they get here, so they go in the url as is. an
// encoded ":" (%3A) isnt what google expects
export const googleFinanceUrl = (symbol: string, exchange: string | null) =>
  `https://www.google.com/finance/quote/${exchange ? `${symbol}:${exchange}` : symbol}`;
