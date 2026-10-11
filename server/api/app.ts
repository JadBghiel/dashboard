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
  consentRoute,
  getLocation,
  getLocationRoute,
  putConsent,
  putLocation,
  putLocationRoute,
  searchLocation,
  searchLocationRoute,
} from "./routes/location";
import {
  cryptoSearch,
  cryptoSearchRoute,
  quoteDetail,
  quoteRoute,
  search,
  searchRoute,
} from "./routes/market";
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
  createInstanceHandler,
  createInstanceRoute,
  deleteInstanceHandler,
  deleteInstanceRoute,
  listInstancesHandler,
  listInstancesRoute,
  reorderInstancesHandler,
  reorderInstancesRoute,
  updateInstanceHandler,
  updateInstanceRoute,
} from "./routes/instances";
import { pingRoute } from "./routes/ping";
import { listServices, servicesRoute } from "./routes/services";
import {
  getSettings,
  getSettingsRoute,
  updateSettings,
  updateSettingsRoute,
} from "./routes/settings";
import { translateRoute, translateText } from "./routes/tools";
import { exportData, exportRoute } from "./routes/account";
import {
  deleteKeyRoute,
  listKeys,
  listKeysRoute,
  putKey,
  removeKey,
  saveKeyRoute,
} from "./routes/credentials";
import { bodyLimit } from "hono/body-limit";

import { rateLimit } from "@/server/rate-limit";
import { widgetData, widgetDataRoute } from "./routes/widgets";

import type { Context, Next } from "hono";

import { auth } from "@/lib/auth";
import { currentUserId } from "@/server/auth/current-user";

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
// better-auth owns everything under /auth: sign-up, sign-in, verify-email, oauth callbacks later
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

// before the routes, so a request over the limit never reaches an upstream. a full dashboard is
// ~15 widget fetches, the timer and the refresh btns stay far under these
// no request body is ever bigger than a few kb, a huge one is refused before it's read. only on the
// methods that carry a body: on a bodiless DELETE, bodyLimit rebuilds the request, and next's request
// object doesnt survive that (every DELETE answered 500)
const limitBody = bodyLimit({
  maxSize: 64 * 1024,
  onError: (c) =>
    c.json<ApiError>({ code: "payload_too_large", message: "The request is too big." }, 413),
});
app.use("*", (c, next) =>
  ["POST", "PUT", "PATCH"].includes(c.req.method) ? limitBody(c, next) : next(),
);
// log in first (the subject): the widget data and what the cards call themselves are for signed in
// users only, like the pages. /about.json, the service catalog and auth stay open
const signedIn = async (c: Context, next: Next) => {
  if (await currentUserId(c.req.raw.headers)) return next();
  return c.json<ApiError>({ code: "unauthorized", message: "Log in to use the widgets." }, 401);
};
for (const path of ["/widgets/*", "/market/*", "/tools/*", "/games/*", "/location", "/location/*"])
  app.use(path, signedIn);

app.use("/widgets/*", rateLimit("widget", 150, 60));
app.use("/tools/translate", rateLimit("translation", 30, 60));
app.use("/location/search", rateLimit("city search", 60, 60));
app.use("/market/search", rateLimit("ticker search", 60, 60));
app.use("/market/crypto-search", rateLimit("coin search", 60, 60));

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
  .openapi(consentRoute, putConsent)
  .openapi(exportRoute, exportData)
  .openapi(listKeysRoute, listKeys)
  .openapi(saveKeyRoute, putKey)
  .openapi(deleteKeyRoute, removeKey)
  .openapi(widgetDataRoute, widgetData)
  .openapi(searchRoute, search)
  .openapi(quoteRoute, quoteDetail)
  .openapi(cryptoSearchRoute, cryptoSearch)
  .openapi(translateRoute, translateText)
  .openapi(wordleGetRoute, wordleGet)
  .openapi(wordlePlayRoute, wordlePlay)
  .openapi(flagsGetRoute, flagsGet)
  .openapi(flagsPlayRoute, flagsPlay)
  .openapi(beeGetRoute, beeGet)
  .openapi(beePlayRoute, beePlay)
  .openapi(best2048GetRoute, best2048Get)
  .openapi(best2048PutRoute, best2048Put)
  .openapi(servicesRoute, listServices)
  // the order route before the :id ones, so "order" isnt read as an id
  .openapi(reorderInstancesRoute, reorderInstancesHandler)
  .openapi(listInstancesRoute, listInstancesHandler)
  .openapi(createInstanceRoute, createInstanceHandler)
  .openapi(updateInstanceRoute, updateInstanceHandler)
  .openapi(deleteInstanceRoute, deleteInstanceHandler)
  .openapi(getSettingsRoute, getSettings)
  .openapi(updateSettingsRoute, updateSettings);

// an image, not json, so outside the openapi routes
app.get("/games/flags/today.png", flagImage);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Dashboard API", version: "0.1.0" },
});

app.get("/docs", Scalar({ url: "/api/openapi.json", pageTitle: "Dashboard API" }));

export const api = routes;
export type ApiType = typeof routes;
