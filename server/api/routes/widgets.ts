/** POST /api/widgets/{service}/{widget}/data: run 1 widget w/ the given params for the current
 * user location widget form will use to preview, #22 adds the instance based batch endpoint on the same runWidget */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";

import { LOCATION_COOKIE, resolveLocation } from "@/server/location";
import { registry } from "@/server/registry";
import { runWidget } from "@/server/registry/run";

import { errorResponse } from "../errors";

export const widgetDataRoute = createRoute({
  method: "post",
  path: "/widgets/{service}/{widget}/data",
  tags: ["widgets"],
  summary: "fetch the data of 1 widget",
  request: {
    params: z.object({ service: z.string(), widget: z.string() }),
    body: {
      required: true,
      content: {
        "application/json": {
          // checked against the widget own schema in runWidget, it knows the real shape
          schema: z.object({ params: z.record(z.string(), z.unknown()).default({}) }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "the widget payload, its shape depends on the widget",
      content: {
        "application/json": {
          schema: z.object({ data: z.unknown(), fetchedAt: z.number().int() }),
        },
      },
    },
    400: errorResponse("a param doesnt match the widget schema"),
    403: errorResponse("the service needs a linked account"),
    404: errorResponse("no such service or widget"),
    422: errorResponse("the params are valid but lead nowhere, e.g. an unknown city"),
    502: errorResponse("the upstream service is down"),
  },
});

export const widgetData: RouteHandler<typeof widgetDataRoute> = async (c) => {
  const { service: serviceId, widget: widgetId } = c.req.valid("param");
  const service = registry.getService(serviceId);
  const widget = registry.getWidget(serviceId, widgetId);
  if (!service || !widget) {
    return c.json({ code: "not_found", message: `No widget ${widgetId} in ${serviceId}.` }, 404);
  }
  // linked accounts and api keys arrive w/ #18/#19, until then only open services can run
  if (service.auth !== "none") {
    return c.json({ code: "forbidden", message: `Link your ${service.name} account first.` }, 403);
  }

  const result = await runWidget(widget, c.req.valid("json").params, {
    location: resolveLocation(getCookie(c, LOCATION_COOKIE), c.req.raw.headers),
    credentials: null,
    signal: c.req.raw.signal,
  });

  if (result.ok) {
    return c.json({ data: result.data, fetchedAt: Math.floor(Date.now() / 1000) }, 200);
  }
  if (result.reason === "invalid_params") {
    return c.json({ code: "invalid_request", message: result.message }, 400);
  }
  if (result.reason === "widget") {
    return c.json({ code: "widget_error", message: result.message }, 422);
  }
  return c.json({ code: "upstream_error", message: result.message }, 502);
};
