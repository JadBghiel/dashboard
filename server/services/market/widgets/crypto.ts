import { z } from "zod";

import { defineWidget, WidgetError } from "@/server/registry/define";

import { CoinId, CRYPTO_MAX } from "@/lib/crypto-watchlist";

import { coinPrices } from "../coingecko";

export const CryptoPayload = z.object({
  currency: z.enum(["usd", "eur", "gbp"]),
  // coingecko failed, these are the last prices we got
  stale: z.boolean(),
  items: z.array(
    z.object({
      id: z.string(),
      symbol: z.string(),
      name: z.string(),
      image: z.string().nullable(),
      price: z.number(),
      changePct: z.number(),
    }),
  ),
});
export type CryptoPayload = z.infer<typeof CryptoPayload>;

export const cryptoWidget = defineWidget({
  id: "crypto_prices",
  name: "Crypto",
  description: "Live crypto prices and their change over 24h",
  params: z.object({
    // coingecko ids, comma separated, the hearted coins in the user's order
    coins: z.string().trim().max(400).default(""),
    currency: z.enum(["usd", "eur", "gbp"]).default("usd"),
  }),
  refresh: { default: 120, min: 60 },
  cache: { ttl: 60 },
  payload: CryptoPayload,
  async fetch({ params, signal }) {
    const ids = params.coins
      ? [
          ...new Set(
            params.coins
              .toLowerCase()
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ]
      : [];
    if (ids.length > CRYPTO_MAX) throw new WidgetError(`${CRYPTO_MAX} coins at most.`);
    if (!ids.every((id) => CoinId.safeParse(id).success)) {
      throw new WidgetError("Coins are CoinGecko ids, like bitcoin or ethereum.");
    }
    if (ids.length === 0) return { currency: params.currency, stale: false, items: [] };

    const { value, stale } = await coinPrices(ids, params.currency, signal);
    return { currency: params.currency, stale, items: value };
  },
});
