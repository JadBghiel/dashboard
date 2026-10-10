/** gdpr: everything we store about the signed in user, in 1 json file they can download. saved api
 * keys come as their hint only, the key itself is never readable back, not even by its owner */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";

import { currentUserId } from "@/server/auth/current-user";
import { db } from "@/server/db";

import { errorResponse, type ApiError } from "../errors";

export const exportRoute = createRoute({
  method: "get",
  path: "/account/export",
  tags: ["account"],
  summary: "download all your data as json",
  responses: {
    200: {
      description: "your account, settings, widgets and saved keys (hints only)",
      content: { "application/json": { schema: z.record(z.string(), z.unknown()) } },
    },
    401: errorResponse("not signed in"),
  },
});

const noUser: ApiError = { code: "unauthorized", message: "Sign in to download your data." };

export const exportData: RouteHandler<typeof exportRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) return c.json(noUser, 401);

  const [account, settings, widgets, apiKeys] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, username: true, displayUsername: true, createdAt: true },
    }),
    db.userSettings.findUnique({ where: { userId }, omit: { userId: true } }),
    db.widgetInstance.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      select: {
        serviceId: true,
        widgetId: true,
        params: true,
        refreshSec: true,
        position: true,
        hidden: true,
        createdAt: true,
      },
    }),
    db.credential.findMany({
      where: { userId },
      select: { serviceId: true, hint: true, createdAt: true },
    }),
  ]);

  const day = new Date().toISOString().slice(0, 10);
  c.header("Content-Disposition", `attachment; filename="dashboard-data-${day}.json"`);
  return c.json({ exportedAt: new Date().toISOString(), account, settings, widgets, apiKeys }, 200);
};
