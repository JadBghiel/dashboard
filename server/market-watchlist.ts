/** the hearted tickers, kept in an httpOnly cookie until accounts exist, then they move into the
 * saved widget. same idea as the location cookie: the server reads it on every request, so the
 * watchlist widget knows what to fetch w/o the browser sending it */

import { z } from "zod";

export const WATCHLIST_COOKIE = "dash_watchlist";
// 10 quotes per refresh on a 60 calls/min key shared by every user, more would starve the others
export const WATCHLIST_MAX = 10;

// AAPL, BRK.B, BF-B... uppercased before the check so "aapl" is fine
export const TickerSymbol = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9.-]{0,11}$/, "not a ticker symbol");

/** the cookie is user controlled: anything that doesnt parse is dropped, never thrown */
export function parseWatchlist(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const text = raw.startsWith("%5B") ? decodeURIComponent(raw) : raw;
    const list = JSON.parse(text);
    if (!Array.isArray(list)) return [];
    const symbols = list.flatMap((s) => {
      const parsed = TickerSymbol.safeParse(s);
      return parsed.success ? [parsed.data] : [];
    });
    return [...new Set(symbols)].slice(0, WATCHLIST_MAX);
  } catch {
    return [];
  }
}
