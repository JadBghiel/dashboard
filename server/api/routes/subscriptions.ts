import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { encryptCredential } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { registry } from "@/server/registry";
import { errorResponse } from "../errors";
import { getSessionUser } from "../session-middleware";

export const subscribeRoute = createRoute({
  method: "post",
  path: "/services/{id}/subscribe",
  tags: ["services"],
  summary: "subscribe to a service",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      required: false,
      content: {
        "application/json": {
          schema: z.object({ apiKey: z.string().min(1).optional() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "now subscribed",
      content: { "application/json": { schema: z.object({ subscribed: z.literal(true) }) } },
    },
    400: errorResponse("api_key service needs an apiKey in the body"),
    401: errorResponse("not logged in"),
    404: errorResponse("no such service"),
    501: errorResponse("oauth services aren't linkable yet"),
  },
});

export const subscribe: RouteHandler<typeof subscribeRoute> = async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ code: "unauthorized", message: "Log in first." }, 401);

  const { id: serviceId } = c.req.valid("param");
  const service = registry.getService(serviceId);

  if (!service) {
    return c.json({ code: "not_found", message: `No service ${serviceId}.` }, 404);
  }
  if (service.auth === "oauth") {
    return c.json(
      { code: "not_implemented", message: "OAuth linking isn't available yet." },
      501,
    );
  }
  if (service.auth === "api_key") {
    const body = c.req.valid("json");
    if (!body.apiKey) {
      return c.json({ code: "bad_request", message: "This service needs an apiKey." }, 400);
    }
    const { ciphertext, iv, tag, hint } = encryptCredential(body.apiKey);

    await prisma.credential.upsert({
      where: { userId_serviceId: { userId: user.id, serviceId } },
      create: { userId: user.id, serviceId, ciphertext, iv, tag, hint },
      update: { ciphertext, iv, tag, hint },
    });
  }
  await prisma.serviceSubscription.upsert({
    where: { userId_serviceId: { userId: user.id, serviceId } },
    create: { userId: user.id, serviceId, status: "active" },
    update: { status: "active" },
  });

  return c.json({ subscribed: true as const }, 200);
};

export const unsubscribeRoute = createRoute({
  method: "delete",
  path: "/services/{id}/subscribe",
  tags: ["services"],
  summary: "unsubscribe from a service",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "no longer subscribed",
      content: { "application/json": { schema: z.object({ subscribed: z.literal(false) }) } },
    },
    401: errorResponse("not logged in"),
    404: errorResponse("no such service"),
  },
});

export const unsubscribe: RouteHandler<typeof unsubscribeRoute> = async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ code: "unauthorized", message: "Log in first." }, 401);

  const { id: serviceId } = c.req.valid("param");
  const service = registry.getService(serviceId);

  if (!service) {
    return c.json({ code: "not_found", message: `No service ${serviceId}.` }, 404);
  }
  await prisma.serviceSubscription.deleteMany({ //Better to use deleteMany rather than delete cuz prisma will throw an error if row doesn't exist
    where: { userId: user.id, serviceId },
  });
  if (service.auth === "api_key") {
    await prisma.credential.deleteMany({
      where: { userId: user.id, serviceId },
    });
  }
  return c.json({ subscribed: false as const }, 200);
};
