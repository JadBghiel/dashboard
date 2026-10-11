/** the market, as 2 services so a missing key only locks what needs it:
 * - market: stocks on finnhub, search, live quotes and a hearted watchlist. the app's key, or the
 *   user's own one saved on the services page
 * - currencies: crypto on coingecko and exchange rates on frankfurter, both keyless, always open */

import { defineService } from "@/server/registry/define";

import { cryptoWidget } from "./widgets/crypto";
import { currencyWidget } from "./widgets/currency";
import { watchlistWidget } from "./widgets/watchlist";

export const market = defineService({
  id: "market",
  name: "Stock market",
  description: "US stocks, live prices and a watchlist",
  category: "utility",
  auth: "api_key",
  key: { label: "Finnhub API key", helpUrl: "https://finnhub.io/register", env: "FINNHUB_API_KEY" },
  widgets: [watchlistWidget],
});

export const currencies = defineService({
  id: "currencies",
  name: "Currencies",
  description: "Crypto prices and exchange rates",
  category: "utility",
  auth: "none",
  widgets: [cryptoWidget, currencyWidget],
});
