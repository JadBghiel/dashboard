/** the stock watchlist rules: how many tickers and what a symbol looks like. the hearted list itself
 * is the widget's tickers param, saved w/ the instance */

import { z } from "zod";

// 10 quotes per refresh on a 60 calls/min key shared by every user, more would starve the others
export const WATCHLIST_MAX = 10;

// AAPL, BRK.B, BF-B... uppercased before the check so "aapl" is fine
export const TickerSymbol = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9.-]{0,11}$/, "not a ticker symbol");
