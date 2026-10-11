/** the stock watchlist rules: how many tickers, the 4 a new user starts with, what a symbol looks
 * like. the hearted list itself is the widget's tickers param, saved w/ the instance */

import { z } from "zod";

// 10 quotes per refresh on a 60 calls/min key shared by every user, more would starve the others
export const WATCHLIST_MAX = 10;

// 4 quotes per refresh, the card isnt empty on a 1st visit and leaves room under the max
export const DEFAULT_TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL"];

// AAPL, BRK.B, BF-B... uppercased before the check so "aapl" is fine
export const TickerSymbol = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9.-]{0,11}$/, "not a ticker symbol");
