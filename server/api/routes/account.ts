/** gdpr: everything we store about the signed in user, in 1 json file they can download. saved api
 * keys come as their hint only, the key itself is never readable back, not even by its owner. same
 * for the oauth tokens, the password hash and the session tokens, they'd let anyone holding the file
 * into the account */

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
      description:
        "your account, linked accounts, sessions, settings, widgets and saved keys (no secrets or tokens)",
      content: { "application/json": { schema: z.record(z.string(), z.unknown()) } },
    },
    401: errorResponse("not signed in"),
  },
});

const noUser: ApiError = { code: "unauthorized", message: "Sign in to download your data." };

export const exportData: RouteHandler<typeof exportRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) return c.json(noUser, 401);

  const [account, linkedAccounts, sessions, settings, widgets, apiKeys] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        emailVerified: true,
        username: true,
        displayUsername: true,
        image: true,
        role: true,
        banned: true,
        banReason: true,
        banExpires: true,
        createdAt: true,
      },
    }),
    // "credential" is the password login, its hash stays out like the tokens
    db.account.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { providerId: true, accountId: true, scope: true, createdAt: true },
    }),
    db.session.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true },
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
  return c.json(
    {
      exportedAt: new Date().toISOString(),
      account,
      linkedAccounts,
      sessions,
      settings,
      widgets,
      apiKeys,
    },
    200,
  );
};
