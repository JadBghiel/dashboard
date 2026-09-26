/** stock market on finnhub: search, live quotes and a hearted watchlist. no account needed, the
 * app holds 1 key server side */

import { defineService } from "@/server/registry/define";

import { cryptoWidget } from "./widgets/crypto";
import { currencyWidget } from "./widgets/currency";
import { watchlistWidget } from "./widgets/watchlist";

export const market = defineService({
  id: "market",
  name: "Stock market",
  description: "Stocks, crypto and currencies",
  category: "utility",
  // 1 app wide key today, a user's own key once accounts and the credential store (#17) land
  auth: "api_key",
  key: { label: "Finnhub API key", helpUrl: "https://finnhub.io/register", env: "FINNHUB_API_KEY" },
  widgets: [watchlistWidget, cryptoWidget, currencyWidget],
});
