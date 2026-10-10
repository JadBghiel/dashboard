/** POST /api/widgets/{service}/{widget}/data: run 1 widget w/ the given params, for where the user
 * is and w/ their own key if they saved one. every card fetches through here */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";

import { userLocation } from "@/server/user-location";
import { currentUserId } from "@/server/auth/current-user";
import { keyFor } from "@/server/credential-store";
import type { ServiceDef, WidgetCredentials } from "@/server/registry/define";
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
          // stale: the upstream is down, this is the last good answer
          schema: z.object({ data: z.unknown(), fetchedAt: z.number().int(), stale: z.boolean() }),
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
  // linked accounts arrive w/ #19. a key service runs on the user's own key when they saved one,
  // else on the app key (#17)
  if (service.auth === "oauth") {
    return c.json({ code: "forbidden", message: `Link your ${service.name} account first.` }, 403);
  }

  const result = await runWidget(serviceId, widget, c.req.valid("json").params, {
    location: await userLocation(c.req.raw.headers, (name) => getCookie(c, name)),
    credentials: await ownKey(c.req.raw.headers, service),
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

async function ownKey(headers: Headers, service: ServiceDef): Promise<WidgetCredentials> {
  if (service.auth !== "api_key") return null;
  const userId = await currentUserId(headers);
  const apiKey = userId && (await keyFor(userId, service.id));
  return apiKey ? { kind: "api_key", apiKey } : null;
}
