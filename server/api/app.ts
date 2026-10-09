/** the api: 1 hono app mounted in a next catch all route
 * routes are declared w/ zod schemas -> the openapi spec on /api/openapi.json and the typed client
 * in lib/api.ts both come from here, known stuff */

import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import { registry } from "@/server/registry";

import { notFound, onError, type ApiError } from "./errors";
import { aboutRoute, buildAbout, clientHost } from "./routes/about";
import {
  deleteLocation,
  deleteLocationRoute,
  getLocation,
  getLocationRoute,
  putLocation,
  putLocationRoute,
  searchLocation,
  searchLocationRoute,
} from "./routes/location";
import {
  addCrypto,
  addCryptoRoute,
  cryptoSearch,
  cryptoSearchRoute,
  getCrypto,
  getCryptoRoute,
  removeCrypto,
  removeCryptoRoute,
  reorderCrypto,
  reorderCryptoRoute,
  addToWatchlist,
  addToWatchlistRoute,
  getWatchlist,
  getWatchlistRoute,
  quoteDetail,
  quoteRoute,
  removeFromWatchlist,
  removeFromWatchlistRoute,
  reorderWatchlist,
  reorderWatchlistRoute,
  search,
  searchRoute,
} from "./routes/market";
import {
  deleteNewsPrefs,
  deleteNewsPrefsRoute,
  getNewsPrefs,
  getNewsPrefsRoute,
  putNewsPrefs,
  putNewsPrefsRoute,
} from "./routes/news";
import {
  beeGet,
  beeGetRoute,
  best2048Get,
  best2048GetRoute,
  best2048Put,
  best2048PutRoute,
  beePlay,
  beePlayRoute,
  flagImage,
  flagsGet,
  flagsGetRoute,
  flagsPlay,
  flagsPlayRoute,
  wordleGet,
  wordleGetRoute,
  wordlePlay,
  wordlePlayRoute,
} from "./routes/games";
import {
  deleteLayout,
  deleteLayoutRoute,
  getLayout,
  getLayoutRoute,
  putLayout,
  putLayoutRoute,
} from "./routes/layout";
import { pingRoute } from "./routes/ping";
import { listServices, servicesRoute } from "./routes/services";
import { emailCheck, emailCheckRoute, translateRoute, translateText } from "./routes/tools";
import { widgetData, widgetDataRoute } from "./routes/widgets";

import { auth } from "@/lib/auth";

import { sessionMiddleware } from "./session-middleware";
import { subscribe, subscribeRoute, unsubscribe, unsubscribeRoute } from "./routes/subscriptions";

// basePath bc the next catch all hands us the full url, /api included
const app = new OpenAPIHono({
  // 1 place for every zod failure, so a bad body reads like any other error
  defaultHook: (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue.path.join(".");
      return c.json<ApiError>(
        {
          code: "invalid_request",
          message: path ? `${path}: ${issue.message}` : issue.message,
        },
        400,
      );
    }
  },
}).basePath("/api");

app.onError(onError);
app.notFound(notFound);
app.use("*", sessionMiddleware);
// better-auth owns everything under /auth: sign-up, sign-in, verify-email, oauth callbacks later
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

const routes = app
  .openapi(pingRoute, (c) =>
    c.json({ message: "pong" as const, time: Math.floor(Date.now() / 1000) }, 200),
  )
  .openapi(aboutRoute, (c) =>
    c.json(buildAbout(clientHost(c.req.raw.headers), registry.catalog), 200),
  )
  .openapi(getLocationRoute, getLocation)
  .openapi(putLocationRoute, putLocation)
  .openapi(deleteLocationRoute, deleteLocation)
  .openapi(searchLocationRoute, searchLocation)
  .openapi(widgetDataRoute, widgetData)
  .openapi(searchRoute, search)
  .openapi(quoteRoute, quoteDetail)
  .openapi(getWatchlistRoute, getWatchlist)
  .openapi(addToWatchlistRoute, addToWatchlist)
  .openapi(removeFromWatchlistRoute, removeFromWatchlist)
  .openapi(reorderWatchlistRoute, reorderWatchlist)
  .openapi(cryptoSearchRoute, cryptoSearch)
  .openapi(getCryptoRoute, getCrypto)
  .openapi(addCryptoRoute, addCrypto)
  .openapi(reorderCryptoRoute, reorderCrypto)
  .openapi(removeCryptoRoute, removeCrypto)
  .openapi(translateRoute, translateText)
  .openapi(emailCheckRoute, emailCheck)
  .openapi(getNewsPrefsRoute, getNewsPrefs)
  .openapi(putNewsPrefsRoute, putNewsPrefs)
  .openapi(deleteNewsPrefsRoute, deleteNewsPrefs)
  .openapi(wordleGetRoute, wordleGet)
  .openapi(wordlePlayRoute, wordlePlay)
  .openapi(flagsGetRoute, flagsGet)
  .openapi(flagsPlayRoute, flagsPlay)
  .openapi(beeGetRoute, beeGet)
  .openapi(beePlayRoute, beePlay)
  .openapi(best2048GetRoute, best2048Get)
  .openapi(best2048PutRoute, best2048Put)
  .openapi(servicesRoute, listServices)
  .openapi(subscribeRoute, subscribe)
  .openapi(unsubscribeRoute, unsubscribe)
  .openapi(getLayoutRoute, getLayout)
  .openapi(putLayoutRoute, putLayout)
  .openapi(deleteLayoutRoute, deleteLayout);

// an image, not json, so outside the openapi routes
app.get("/games/flags/today.png", flagImage);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Dashboard API", version: "0.1.0" },
});

app.get("/docs", Scalar({ url: "/api/openapi.json", pageTitle: "Dashboard API" }));

export const api = routes;
export type ApiType = typeof routes;
