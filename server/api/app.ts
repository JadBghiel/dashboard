/** the api: 1 hono app mounted in a next catch all route
 * routes are declared w/ zod schemas -> the openapi spec on /api/openapi.json and the typed client
 * in lib/api.ts both come from here, known stuff */

import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import { registry } from "@/server/registry";

import { notFound, onError, type ApiError } from "./errors";
import { aboutRoute, buildAbout, clientHost } from "./routes/about";
import { pingRoute } from "./routes/ping";

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

const routes = app
  .openapi(pingRoute, (c) =>
    c.json({ message: "pong" as const, time: Math.floor(Date.now() / 1000) }, 200),
  )
  .openapi(aboutRoute, (c) =>
    c.json(buildAbout(clientHost(c.req.raw.headers), registry.catalog), 200),
  );

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Dashboard API", version: "0.1.0" },
});

app.get("/docs", Scalar({ url: "/api/openapi.json", pageTitle: "Dashboard API" }));

export const api = routes;
export type ApiType = typeof routes;
