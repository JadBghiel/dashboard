/** the crypto watchlist rules: how many coins, the 8 a new user starts with, what a coin id looks
 * like. the hearted list itself is the widget's coins param, saved w/ the instance */

import { z } from "zod";

// coingecko takes them all in 1 call, the limit is only about the card staying readable
export const CRYPTO_MAX = 15;

export const DEFAULT_COINS = [
  "bitcoin",
  "ethereum",
  "solana",
  "binancecoin",
  "ripple",
  "cardano",
  "dogecoin",
  "tron",
];

// coingecko ids: bitcoin, binancecoin, shiba-inu...
export const CoinId = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,59}$/, "not a coingecko id");
