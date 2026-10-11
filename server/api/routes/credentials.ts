/** the signed in user's own api keys: list (hints only), save, remove. only services that take a
 * key accept one, and a saved key is never sent back, not even to its owner */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";

import { deleteKey, listHints, saveKey } from "@/server/credential-store";
import { registry } from "@/server/registry";

import { errorResponse } from "../errors";
import { json, unauthorized, userOf } from "../shared";

const Hint = z.object({ serviceId: z.string(), hint: z.string() });
const Service = z.object({ serviceId: z.string().max(40) });

export const listKeysRoute = createRoute({
  method: "get",
  path: "/credentials",
  tags: ["credentials"],
  summary: "your saved keys, the last 4 characters of each only",
  responses: { 200: json("your keys", z.object({ keys: z.array(Hint) })), ...unauthorized },
});

export const saveKeyRoute = createRoute({
  method: "put",
  path: "/credentials/{serviceId}",
  tags: ["credentials"],
  summary: "save your own key for a service, stored encrypted",
  request: {
    params: Service,
    body: {
      required: true,
      content: {
        "application/json": { schema: z.object({ apiKey: z.string().trim().min(8).max(200) }) },
      },
    },
  },
  responses: {
    200: json("saved, its hint", Hint),
    400: errorResponse("the service refused the key"),
    404: errorResponse("no service that takes a key"),
    ...unauthorized,
  },
});

export const deleteKeyRoute = createRoute({
  method: "delete",
  path: "/credentials/{serviceId}",
  tags: ["credentials"],
  summary: "remove your key, the app key takes over again",
  request: { params: Service },
  responses: { 204: { description: "removed" }, ...unauthorized },
});

export const listKeys: RouteHandler<typeof listKeysRoute> = async (c) => {
  const userId = await userOf(c);
  return c.json({ keys: await listHints(userId) }, 200);
};

export const putKey: RouteHandler<typeof saveKeyRoute> = async (c) => {
  const userId = await userOf(c);
  const { serviceId } = c.req.valid("param");
  const service = registry.getService(serviceId);
  if (service?.auth !== "api_key") {
    return c.json({ code: "not_found", message: "That service doesn't take a key." }, 404);
  }
  const { apiKey } = c.req.valid("json");
  // a mistyped key would be saved and every card would just fail, the user is told now instead
  if ((await service.key?.check?.(apiKey, AbortSignal.timeout(8000))) === false) {
    const message = `This ${service.key?.label ?? "key"} was refused. Check it and try again.`;
    return c.json({ code: "invalid_key", message }, 400);
  }
  return c.json(await saveKey(userId, serviceId, apiKey), 200);
};

export const removeKey: RouteHandler<typeof deleteKeyRoute> = async (c) => {
  const userId = await userOf(c);
  await deleteKey(userId, c.req.valid("param").serviceId);
  return c.body(null, 204);
};
