import { z } from "zod";

import { TickerSymbol, WATCHLIST_MAX } from "@/lib/market-watchlist";
import { defineWidget, WidgetError } from "@/server/registry/define";

import { profile, quote, UnknownTickerError } from "../finnhub";

export const WatchlistPayload = z.object({
  change: z.enum(["percent", "amount"]),
  items: z.array(
    z.object({
      symbol: z.string(),
      name: z.string(),
      logo: z.string().nullable(),
      exchange: z.string().nullable(),
      currency: z.string(),
      price: z.number(),
      change: z.number(),
      changePct: z.number(),
      // the last price we got, finnhub failed this time (#30)
      stale: z.boolean(),
    }),
  ),
});
export type WatchlistPayload = z.infer<typeof WatchlistPayload>;

export const watchlistWidget = defineWidget({
  id: "stock_watchlist",
  name: "Stock market",
  description: "Live prices for your tickers, with a search to add new ones",
  params: z.object({
    // comma list like "AAPL,MSFT", the hearted tickers in the user's order
    tickers: z.string().trim().max(120).default(""),
    change: z.enum(["percent", "amount"]).default("percent"),
  }),
  // quotes move, but the free plan is 60 calls/min for everyone
  refresh: { default: 120, min: 60 },
  cache: { ttl: 60 },
  payload: WatchlistPayload,
  async fetch({ params, credentials, signal }) {
    const ownKey = credentials?.kind === "api_key" ? credentials.apiKey : undefined;
    const symbols = params.tickers
      ? [
          ...new Set(
            params.tickers
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ]
      : [];

    const valid = symbols.flatMap((s) => {
      const parsed = TickerSymbol.safeParse(s);
      return parsed.success ? [parsed.data] : [];
    });
    if (valid.length < symbols.length) {
      throw new WidgetError("One of the tickers isn't a valid symbol.");
    }

    const results = await Promise.allSettled(
      valid.slice(0, WATCHLIST_MAX).map(async (symbol) => {
        const [q, p] = await Promise.all([
          quote(symbol, signal, ownKey),
          profile(symbol, signal, ownKey),
        ]);
        return {
          symbol,
          name: p.name,
          logo: p.logo,
          exchange: p.exchange,
          currency: p.currency,
          price: q.price,
          change: q.change,
          changePct: q.changePct,
          stale: q.stale,
        };
      }),
    );

    // 1 delisted ticker is just left out, it shouldnt blank the whole list. anything else (finnhub
    // down w/ no last good price, no key) has to surface when nothing came back
    const items = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failure = results.find(
      (r): r is PromiseRejectedResult =>
        r.status === "rejected" && !(r.reason instanceof UnknownTickerError),
    );
    if (items.length === 0 && failure) throw failure.reason;

    return { change: params.change, items };
  },
});
