/** the signed in user's widgets: list, add, configure, remove, reorder. who the user is comes from
 * currentUserId, the logic and the per user scoping live in server/instances.ts */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import type { Context } from "hono";

import { currentUserId } from "@/server/auth/current-user";
import {
  createInstance,
  deleteInstance,
  InstanceError,
  listInstances,
  reorderInstances,
  updateInstance,
} from "@/server/instances";

import { errorResponse, type ApiError } from "../errors";

const Instance = z.object({
  id: z.string(),
  serviceId: z.string(),
  widgetId: z.string(),
  params: z.record(z.string(), z.unknown()),
  refreshSec: z.number().int(),
  position: z.number().int(),
});
const List = z.object({ instances: z.array(Instance) });
const Id = z.object({ id: z.string().min(1).max(40) });
const Params = z.record(z.string(), z.unknown());

const json = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});
const unauthorized = { 401: errorResponse("not signed in") };

export const listInstancesRoute = createRoute({
  method: "get",
  path: "/instances",
  tags: ["instances"],
  summary: "your widgets in dashboard order, the defaults on your 1st visit",
  responses: { 200: json("your widgets", List), ...unauthorized },
});

export const createInstanceRoute = createRoute({
  method: "post",
  path: "/instances",
  tags: ["instances"],
  summary:
    "add a widget, the same 1 as many times as you want, its params checked against its schema",
  request: body(
    z.object({
      serviceId: z.string().max(40),
      widgetId: z.string().max(40),
      params: Params.optional(),
      refreshSec: z.number().int().optional(),
    }),
  ),
  responses: {
    201: json("the new widget", Instance),
    400: errorResponse("bad params or refresh rate"),
    403: errorResponse("the service needs a subscription: your key or a linked account"),
    404: errorResponse("no such widget"),
    ...unauthorized,
  },
});

export const updateInstanceRoute = createRoute({
  method: "patch",
  path: "/instances/{id}",
  tags: ["instances"],
  summary: "change a widget's options or refresh rate, params are merged into the saved ones",
  request: {
    params: Id,
    ...body(
      z.object({
        params: Params.optional(),
        refreshSec: z.number().int().optional(),
      }),
    ),
  },
  responses: {
    200: json("the widget as saved", Instance),
    400: errorResponse("bad params or refresh rate"),
    404: errorResponse("not 1 of your widgets"),
    ...unauthorized,
  },
});

export const deleteInstanceRoute = createRoute({
  method: "delete",
  path: "/instances/{id}",
  tags: ["instances"],
  summary: "remove a widget from your dashboard",
  request: { params: Id },
  responses: {
    204: { description: "removed" },
    404: errorResponse("not 1 of your widgets"),
    ...unauthorized,
  },
});

export const reorderInstancesRoute = createRoute({
  method: "put",
  path: "/instances/order",
  tags: ["instances"],
  summary: "the new order of all your widgets, after a drag",
  request: body(z.object({ ids: z.array(z.string().max(40)).max(200) })),
  responses: {
    200: json("your widgets in the new order", List),
    400: errorResponse("the list isnt exactly your widgets"),
    ...unauthorized,
  },
});

const NO_USER: ApiError = { code: "unauthorized", message: "Sign in to see your dashboard." };

function failed(c: Context, err: unknown) {
  if (!(err instanceof InstanceError)) throw err;
  const code =
    err.status === 404 ? "not_found" : err.status === 403 ? "not_subscribed" : "bad_request";
  const body: ApiError = { code, message: err.message };
  if (err.status === 404) return c.json(body, 404);
  return err.status === 403 ? c.json(body, 403) : c.json(body, 400);
}

export const listInstancesHandler: RouteHandler<typeof listInstancesRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) return c.json(NO_USER, 401);
  return c.json({ instances: (await listInstances(userId)) as z.infer<typeof Instance>[] }, 200);
};

export const createInstanceHandler: RouteHandler<typeof createInstanceRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) return c.json(NO_USER, 401);
  const input = c.req.valid("json");
  try {
    const row = await createInstance(userId, input);
    return c.json(row as z.infer<typeof Instance>, 201);
  } catch (err) {
    return failed(c, err);
  }
};

export const updateInstanceHandler: RouteHandler<typeof updateInstanceRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) return c.json(NO_USER, 401);
  try {
    const row = await updateInstance(userId, c.req.valid("param").id, c.req.valid("json"));
    return c.json(row as z.infer<typeof Instance>, 200);
  } catch (err) {
    // no subscription check on a change, only 404 or bad values
    if (!(err instanceof InstanceError)) throw err;
    if (err.status === 404) return c.json({ code: "not_found", message: err.message }, 404);
    return c.json({ code: "bad_request", message: err.message }, 400);
  }
};

export const deleteInstanceHandler: RouteHandler<typeof deleteInstanceRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) return c.json(NO_USER, 401);
  try {
    await deleteInstance(userId, c.req.valid("param").id);
    return c.body(null, 204);
  } catch (err) {
    return failed(c, err);
  }
};

export const reorderInstancesHandler: RouteHandler<typeof reorderInstancesRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) return c.json(NO_USER, 401);
  try {
    const rows = await reorderInstances(userId, c.req.valid("json").ids);
    return c.json({ instances: rows as z.infer<typeof Instance>[] }, 200);
  } catch (err) {
    if (!(err instanceof InstanceError)) throw err;
    return c.json({ code: "bad_request", message: err.message }, 400);
  }
};
