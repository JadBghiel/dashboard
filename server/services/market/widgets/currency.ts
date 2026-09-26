import { z } from "zod";

import { defineWidget, WidgetError } from "@/server/registry/define";

import { CURRENCIES, latestRates } from "../frankfurter";

export const CurrencyPayload = z.object({
  from: z.string(),
  amount: z.number(),
  // the day the ecb published these rates
  date: z.string(),
  // 1 `from` in each currency, the card multiplies by whatever amount the user types
  rates: z.array(z.object({ currency: z.string(), rate: z.number() })),
  currencies: z.array(z.string()),
});
export type CurrencyPayload = z.infer<typeof CurrencyPayload>;

const Code = z.string().trim().toUpperCase().length(3);

export const currencyWidget = defineWidget({
  id: "currency_converter",
  name: "Currency converter",
  description: "Convert an amount between currencies at today's ECB rates",
  params: z.object({
    from: z.string().trim().max(3).default("EUR"),
    // comma separated
    to: z.string().trim().max(60).default("USD,GBP,JPY"),
    amount: z.number().int().min(1).max(1_000_000_000).default(100),
  }),
  sizes: ["1x1", "2x1"],
  refresh: { default: 3600, min: 600 },
  cache: { ttl: 3600 },
  payload: CurrencyPayload,
  async fetch({ params, signal }) {
    const from = Code.safeParse(params.from);
    const to = params.to
      .split(",")
      .map((s) => Code.safeParse(s))
      .flatMap((r) => (r.success ? [r.data] : []));
    if (!from.success) throw new WidgetError("The source currency is a 3 letter code, like EUR.");
    if (to.length === 0) throw new WidgetError("Pick at least 1 currency to convert to.");
    if (to.length > 8) throw new WidgetError("8 currencies at most.");

    const { date, rates } = await latestRates(from.data, [...new Set(to)], signal);
    return {
      from: from.data,
      amount: params.amount,
      date,
      rates: [...new Set(to)].map((c) => ({ currency: c, rate: rates[c] })),
      currencies: [...CURRENCIES],
    };
  },
});
