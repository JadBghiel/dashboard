/** the hearted coins, kept in an httpOnly cookie until accounts exist, same as the stock watchlist.
 * no cookie at all = the default list, an empty list = the user removed everything on purpose */

import { z } from "zod";

import { parseJsonCookie } from "./cookies";

export const CRYPTO_COOKIE = "dash_crypto";
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

const CoinList = z.array(z.string());

export function parseCryptoList(raw: string | undefined): string[] {
  const list = parseJsonCookie(raw, CoinList);
  if (list === null) return DEFAULT_COINS;
  const ids = list.flatMap((s) => {
    const parsed = CoinId.safeParse(s);
    return parsed.success ? [parsed.data] : [];
  });
  return [...new Set(ids)].slice(0, CRYPTO_MAX);
}
