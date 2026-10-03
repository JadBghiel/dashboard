/** the dashboard layout: the order of the widgets in each section, in an httpOnly cookie */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { deleteCookie } from "hono/cookie";

import { readJsonCookie, writeJsonCookie } from "@/server/cookies";
import { LAYOUT_COOKIE, normalizeLayout, SavedLayout } from "@/lib/dashboard-layout";

const LayoutOut = z.object({
  utility: z.array(z.string()),
  news: z.array(z.string()),
  games: z.array(z.string()),
});

const ok = (description: string) => ({
  200: { description, content: { "application/json": { schema: LayoutOut } } },
});

export const getLayoutRoute = createRoute({
  method: "get",
  path: "/layout",
  tags: ["layout"],
  summary: "the order of the widgets in each section",
  responses: ok("the layout, the default order when nothing is saved"),
});

export const putLayoutRoute = createRoute({
  method: "put",
  path: "/layout",
  tags: ["layout"],
  summary: "save a new order. unknown ids are dropped and missing ones appended",
  request: { body: { content: { "application/json": { schema: SavedLayout } } } },
  responses: ok("the layout as saved"),
});

export const deleteLayoutRoute = createRoute({
  method: "delete",
  path: "/layout",
  tags: ["layout"],
  summary: "back to the default order",
  responses: ok("the default layout"),
});

export const getLayout: RouteHandler<typeof getLayoutRoute> = (c) =>
  c.json(normalizeLayout(readJsonCookie(c, LAYOUT_COOKIE, SavedLayout)), 200);

export const putLayout: RouteHandler<typeof putLayoutRoute> = (c) => {
  const layout = normalizeLayout(c.req.valid("json"));
  writeJsonCookie(c, LAYOUT_COOKIE, layout);
  return c.json(layout, 200);
};

export const deleteLayout: RouteHandler<typeof deleteLayoutRoute> = (c) => {
  deleteCookie(c, LAYOUT_COOKIE, { path: "/" });
  return c.json(normalizeLayout(null), 200);
};
