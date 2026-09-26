/** market: ticker search, the extended view of 1 ticker, and the hearted watchlist in an httpOnly
 * cookie. the prices of the watchlist itself come through the stock_watchlist widget */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

import { prefCookie } from "@/server/cookies";
import { CoinId, CRYPTO_COOKIE, CRYPTO_MAX, parseCryptoList } from "@/server/crypto-watchlist";
import {
  parseWatchlist,
  TickerSymbol,
  WATCHLIST_COOKIE,
  WATCHLIST_MAX,
} from "@/server/market-watchlist";
import { WidgetError } from "@/server/registry/define";
import { googleFinanceUrl, profile, quote, searchSymbols } from "@/server/services/market/finnhub";
import { searchCoins } from "@/server/services/market/coingecko";

import { errorResponse } from "../errors";

const json = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});

const WatchlistResponse = z.object({ symbols: z.array(z.string()) });

// ---- routes ----

export const searchRoute = createRoute({
  method: "get",
  path: "/market/search",
  tags: ["market"],
  summary: "find a ticker by name or symbol, us listings only",
  request: { query: z.object({ q: z.string().trim().min(1).max(40) }) },
  responses: {
    200: json(
      "up to 8 matches",
      z.object({ results: z.array(z.object({ symbol: z.string(), name: z.string() })) }),
    ),
    400: errorResponse("the query is empty or too long"),
    422: errorResponse("market data isnt configured"),
    502: errorResponse("finnhub is down"),
  },
});

export const quoteRoute = createRoute({
  method: "get",
  path: "/market/quote/{symbol}",
  tags: ["market"],
  summary: "everything the extended view shows for 1 ticker",
  request: { params: z.object({ symbol: TickerSymbol }) },
  responses: {
    200: json(
      "the quote and the company",
      z.object({
        symbol: z.string(),
        name: z.string(),
        logo: z.string().nullable(),
        exchange: z.string().nullable(),
        currency: z.string(),
        price: z.number(),
        change: z.number(),
        changePct: z.number(),
        open: z.number(),
        high: z.number(),
        low: z.number(),
        prevClose: z.number(),
        stale: z.boolean(),
        googleUrl: z.string(),
      }),
    ),
    400: errorResponse("not a ticker symbol"),
    422: errorResponse("unknown ticker, a non us one, or market data isnt configured"),
    502: errorResponse("finnhub is down and we have no last price"),
  },
});

export const getWatchlistRoute = createRoute({
  method: "get",
  path: "/market/watchlist",
  tags: ["market"],
  summary: "the hearted tickers",
  responses: { 200: json("the symbols, in the order they were hearted", WatchlistResponse) },
});

export const addToWatchlistRoute = createRoute({
  method: "post",
  path: "/market/watchlist",
  tags: ["market"],
  summary: "heart a ticker",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: z.object({ symbol: TickerSymbol }) } },
    },
  },
  responses: {
    200: json("the watchlist after the change", WatchlistResponse),
    400: errorResponse(`not a ticker symbol, or the watchlist already has ${WATCHLIST_MAX}`),
  },
});

export const reorderWatchlistRoute = createRoute({
  method: "put",
  path: "/market/watchlist",
  tags: ["market"],
  summary: "reorder the watchlist after a drag",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ symbols: z.array(TickerSymbol).max(WATCHLIST_MAX) }),
        },
      },
    },
  },
  responses: {
    200: json("the watchlist in its new order", WatchlistResponse),
    400: errorResponse("the list isnt exactly the saved tickers in another order"),
  },
});

export const removeFromWatchlistRoute = createRoute({
  method: "delete",
  path: "/market/watchlist/{symbol}",
  tags: ["market"],
  summary: "unheart a ticker",
  request: { params: z.object({ symbol: TickerSymbol }) },
  responses: {
    200: json("the watchlist after the change", WatchlistResponse),
    400: errorResponse("not a ticker symbol"),
  },
});

// ---- handlers ----

const timeout = (c: Context) => AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(8000)]);
const saved = (c: Context) => parseWatchlist(getCookie(c, WATCHLIST_COOKIE));
const save = (c: Context, symbols: string[]) =>
  setCookie(c, WATCHLIST_COOKIE, JSON.stringify(symbols), prefCookie(c.req.url));

// a WidgetError is the user's to read (unknown ticker, no key), anything else stays in the logs
function failure(err: unknown) {
  if (err instanceof WidgetError) {
    return { status: 422 as const, body: { code: "widget_error", message: err.message } };
  }
  console.error("market request failed", err);
  return {
    status: 502 as const,
    body: { code: "upstream_error", message: "Market data is unavailable right now." },
  };
}

export const search: RouteHandler<typeof searchRoute> = async (c) => {
  try {
    return c.json({ results: await searchSymbols(c.req.valid("query").q, timeout(c)) }, 200);
  } catch (err) {
    const f = failure(err);
    return f.status === 422 ? c.json(f.body, 422) : c.json(f.body, 502);
  }
};

export const quoteDetail: RouteHandler<typeof quoteRoute> = async (c) => {
  const { symbol } = c.req.valid("param");
  try {
    const signal = timeout(c);
    const [q, p] = await Promise.all([quote(symbol, signal), profile(symbol, signal)]);
    return c.json(
      {
        symbol,
        name: p.name,
        logo: p.logo,
        exchange: p.exchange,
        currency: p.currency,
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        open: q.open,
        high: q.high,
        low: q.low,
        prevClose: q.prevClose,
        stale: q.stale,
        googleUrl: googleFinanceUrl(symbol, p.exchange),
      },
      200,
    );
  } catch (err) {
    const f = failure(err);
    return f.status === 422 ? c.json(f.body, 422) : c.json(f.body, 502);
  }
};

export const getWatchlist: RouteHandler<typeof getWatchlistRoute> = (c) =>
  c.json({ symbols: saved(c) }, 200);

export const addToWatchlist: RouteHandler<typeof addToWatchlistRoute> = (c) => {
  const { symbol } = c.req.valid("json");
  const symbols = saved(c);
  if (symbols.includes(symbol)) return c.json({ symbols }, 200);
  if (symbols.length >= WATCHLIST_MAX) {
    return c.json(
      { code: "invalid_request", message: `Your watchlist is full (${WATCHLIST_MAX} tickers).` },
      400,
    );
  }
  const next = [...symbols, symbol];
  save(c, next);
  return c.json({ symbols: next }, 200);
};

export const removeFromWatchlist: RouteHandler<typeof removeFromWatchlistRoute> = (c) => {
  const { symbol } = c.req.valid("param");
  const next = saved(c).filter((s) => s !== symbol);
  save(c, next);
  return c.json({ symbols: next }, 200);
};

// a reorder only moves tickers around: same ones, each once. anything else would let this route add
// or drop tickers behind the heart button's back
export const reorderWatchlist: RouteHandler<typeof reorderWatchlistRoute> = (c) => {
  const { symbols } = c.req.valid("json");
  const current = saved(c);
  const same =
    symbols.length === current.length &&
    new Set(symbols).size === symbols.length &&
    symbols.every((s) => current.includes(s));
  if (!same) {
    return c.json(
      { code: "invalid_request", message: "The new order must list the same tickers." },
      400,
    );
  }
  save(c, symbols);
  return c.json({ symbols }, 200);
};

// ---- crypto: search and the hearted coins ----

const CryptoWatchlistResponse = z.object({ ids: z.array(z.string()) });

export const cryptoSearchRoute = createRoute({
  method: "get",
  path: "/market/crypto-search",
  tags: ["market"],
  summary: "find a coin by name or symbol",
  request: { query: z.object({ q: z.string().trim().min(1).max(40) }) },
  responses: {
    200: json(
      "up to 8 coins",
      z.object({
        results: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            symbol: z.string(),
            image: z.string().nullable(),
          }),
        ),
      }),
    ),
    400: errorResponse("the query is empty or too long"),
    502: errorResponse("coingecko is down"),
  },
});

export const getCryptoRoute = createRoute({
  method: "get",
  path: "/market/crypto-watchlist",
  tags: ["market"],
  summary: "the hearted coins, the default list until you change it",
  responses: { 200: json("the coin ids, in order", CryptoWatchlistResponse) },
});

export const addCryptoRoute = createRoute({
  method: "post",
  path: "/market/crypto-watchlist",
  tags: ["market"],
  summary: "heart a coin",
  request: {
    body: { required: true, content: { "application/json": { schema: z.object({ id: CoinId }) } } },
  },
  responses: {
    200: json("the list after the change", CryptoWatchlistResponse),
    400: errorResponse(`not a coin id, or the list already has ${CRYPTO_MAX}`),
  },
});

export const reorderCryptoRoute = createRoute({
  method: "put",
  path: "/market/crypto-watchlist",
  tags: ["market"],
  summary: "reorder the coins after a drag",
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: z.object({ ids: z.array(CoinId).max(CRYPTO_MAX) }) },
      },
    },
  },
  responses: {
    200: json("the list in its new order", CryptoWatchlistResponse),
    400: errorResponse("the list isnt exactly the saved coins in another order"),
  },
});

export const removeCryptoRoute = createRoute({
  method: "delete",
  path: "/market/crypto-watchlist/{id}",
  tags: ["market"],
  summary: "unheart a coin",
  request: { params: z.object({ id: CoinId }) },
  responses: {
    200: json("the list after the change", CryptoWatchlistResponse),
    400: errorResponse("not a coin id"),
  },
});

const savedCoins = (c: Context) => parseCryptoList(getCookie(c, CRYPTO_COOKIE));
const saveCoins = (c: Context, ids: string[]) =>
  setCookie(c, CRYPTO_COOKIE, JSON.stringify(ids), prefCookie(c.req.url));

export const cryptoSearch: RouteHandler<typeof cryptoSearchRoute> = async (c) => {
  try {
    return c.json({ results: await searchCoins(c.req.valid("query").q, timeout(c)) }, 200);
  } catch (err) {
    console.error("coin search failed", err);
    return c.json(
      { code: "upstream_error", message: "Coin search is unavailable right now." },
      502,
    );
  }
};

export const getCrypto: RouteHandler<typeof getCryptoRoute> = (c) =>
  c.json({ ids: savedCoins(c) }, 200);

export const addCrypto: RouteHandler<typeof addCryptoRoute> = (c) => {
  const { id } = c.req.valid("json");
  const ids = savedCoins(c);
  if (ids.includes(id)) return c.json({ ids }, 200);
  if (ids.length >= CRYPTO_MAX) {
    return c.json(
      { code: "invalid_request", message: `Your list is full (${CRYPTO_MAX} coins).` },
      400,
    );
  }
  const next = [...ids, id];
  saveCoins(c, next);
  return c.json({ ids: next }, 200);
};

// same rule as the stocks: a reorder only moves coins around, it cant add or drop one
export const reorderCrypto: RouteHandler<typeof reorderCryptoRoute> = (c) => {
  const { ids } = c.req.valid("json");
  const current = savedCoins(c);
  const same =
    ids.length === current.length &&
    new Set(ids).size === ids.length &&
    ids.every((id) => current.includes(id));
  if (!same) {
    return c.json(
      { code: "invalid_request", message: "The new order must list the same coins." },
      400,
    );
  }
  saveCoins(c, ids);
  return c.json({ ids }, 200);
};

export const removeCrypto: RouteHandler<typeof removeCryptoRoute> = (c) => {
  const { id } = c.req.valid("param");
  const next = savedCoins(c).filter((x) => x !== id);
  saveCoins(c, next);
  return c.json({ ids: next }, 200);
};
