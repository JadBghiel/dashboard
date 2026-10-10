/** POST /api/widgets/{service}/{widget}/data: run 1 widget w/ the given params, for where the user
 * is and w/ their own key if they saved one. every card fetches through here */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";

import { userLocation } from "@/server/user-location";
import { currentUserId } from "@/server/auth/current-user";
import { registry } from "@/server/registry";
import { runWidget } from "@/server/registry/run";
import { NotSubscribedError, requireSubscription } from "@/server/subscriptions";
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
          // stale: the upstream is down, this is the last good answer
          schema: z.object({ data: z.unknown(), fetchedAt: z.number().int(), stale: z.boolean() }),
        },
      },
    },
    400: errorResponse("a param doesnt match the widget schema"),
    401: errorResponse("not logged in"),
    403: errorResponse("the service needs a subscription"),
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
  // a locked service answers 403 before anything goes upstream. a key service runs on the user's
  // own key when they saved one, else on the app key (#17, #18)
  let credentials;
  try {
    credentials = await requireSubscription(await currentUserId(c.req.raw.headers), service);
  } catch (err) {
    if (!(err instanceof NotSubscribedError)) throw err;
    return c.json({ code: "not_subscribed", message: err.message }, 403);
  }

  const result = await runWidget(serviceId, widget, c.req.valid("json").params, {
    location: await userLocation(c.req.raw.headers, (name) => getCookie(c, name)),
    credentials,
    signal: c.req.raw.signal,
  });

  if (result.ok) {
    return c.json(
      { data: result.data, fetchedAt: Math.floor(Date.now() / 1000), stale: result.stale },
      200,
    );
  }
  if (result.reason === "invalid_params") {
    return c.json({ code: "invalid_request", message: result.message }, 400);
  }
  if (result.reason === "widget") {
    return c.json({ code: "widget_error", message: result.message }, 422);
  }
  return c.json({ code: "upstream_error", message: result.message }, 502);
};
