/** market: ticker search, the extended view of 1 ticker, and the coin search. the hearted lists are
 * the widgets' own params, saved w/ the instance, their prices come through the widgets */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import type { Context } from "hono";

import { currentUserId } from "@/server/auth/current-user";
import { TickerSymbol } from "@/server/market-watchlist";
import { registry } from "@/server/registry";
import { WidgetError } from "@/server/registry/define";
import { googleFinanceUrl, profile, quote, searchSymbols } from "@/server/services/market/finnhub";
import { searchCoins } from "@/server/services/market/coingecko";
import { NotSubscribedError, requireSubscription } from "@/server/subscriptions";

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
    403: errorResponse("no app key on the server and the user saved none"),
    422: errorResponse("finnhub refused the search"),
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
    403: errorResponse("no app key on the server and the user saved none"),
    422: errorResponse("unknown ticker or a non us one"),
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

/** the user's own finnhub key when they saved one, null = the app key. throws NotSubscribedError when
 * neither exists, the routes answer it w/ the same 403 as the widget (#18) */
async function marketKey(c: Context) {
  const service = registry.getService("market")!;
  const creds = await requireSubscription(await currentUserId(c.req.raw.headers), service);
  return creds?.kind === "api_key" ? creds.apiKey : undefined;
}

const notSubscribed = (err: NotSubscribedError) => ({
  code: "not_subscribed",
  message: err.message,
});

export const search: RouteHandler<typeof searchRoute> = async (c) => {
  try {
    const key = await marketKey(c);
    return c.json({ results: await searchSymbols(c.req.valid("query").q, timeout(c), key) }, 200);
  } catch (err) {
    if (err instanceof NotSubscribedError) return c.json(notSubscribed(err), 403);
    const f = failure(err);
    return f.status === 422 ? c.json(f.body, 422) : c.json(f.body, 502);
  }
};

export const quoteDetail: RouteHandler<typeof quoteRoute> = async (c) => {
  const { symbol } = c.req.valid("param");
  try {
    const signal = timeout(c);
    const key = await marketKey(c);
    const [q, p] = await Promise.all([quote(symbol, signal, key), profile(symbol, signal, key)]);
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
    if (err instanceof NotSubscribedError) return c.json(notSubscribed(err), 403);
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
