/** market: ticker search, the extended view of 1 ticker, and the coin search. the hearted lists are
 * the widgets' own params, saved w/ the instance, their prices come through the widgets */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import type { Context } from "hono";

import { TickerSymbol } from "@/server/market-watchlist";
import { WidgetError } from "@/server/registry/define";
import { googleFinanceUrl, profile, quote, searchSymbols } from "@/server/services/market/finnhub";
import { searchCoins } from "@/server/services/market/coingecko";

import { errorResponse } from "../errors";

const json = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});

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

// ---- handlers ----

const timeout = (c: Context) => AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(8000)]);
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

// ---- crypto search ----

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
