/** the user's news preferences: read, save, reset. kept in an httpOnly cookie until accounts exist */

import { createRoute, type RouteHandler } from "@hono/zod-openapi";
import { deleteCookie } from "hono/cookie";

import { readJsonCookie, writeJsonCookie } from "@/server/cookies";
import { DEFAULT_NEWS, NEWS_COOKIE, NewsPrefs } from "@/server/news-prefs";

import { errorResponse } from "../errors";

const prefsOk = {
  description: "the preferences the news widget uses",
  content: { "application/json": { schema: NewsPrefs } },
};

export const getNewsPrefsRoute = createRoute({
  method: "get",
  path: "/news/prefs",
  tags: ["news"],
  summary: "the news preferences, the defaults when none were saved",
  responses: { 200: prefsOk },
});

export const putNewsPrefsRoute = createRoute({
  method: "put",
  path: "/news/prefs",
  tags: ["news"],
  summary: "save the news preferences",
  request: { body: { required: true, content: { "application/json": { schema: NewsPrefs } } } },
  responses: { 200: prefsOk, 400: errorResponse("an unknown topic, language or country") },
});

export const deleteNewsPrefsRoute = createRoute({
  method: "delete",
  path: "/news/prefs",
  tags: ["news"],
  summary: "back to the default news",
  responses: { 200: prefsOk },
});

export const getNewsPrefs: RouteHandler<typeof getNewsPrefsRoute> = (c) =>
  c.json(readJsonCookie(c, NEWS_COOKIE, NewsPrefs) ?? DEFAULT_NEWS, 200);

export const putNewsPrefs: RouteHandler<typeof putNewsPrefsRoute> = (c) => {
  const prefs = c.req.valid("json");
  // the same keyword twice would just be the same feed twice
  const clean = { ...prefs, keywords: [...new Set(prefs.keywords.map((k) => k.toLowerCase()))] };
  writeJsonCookie(c, NEWS_COOKIE, clean);
  return c.json(clean, 200);
};

export const deleteNewsPrefs: RouteHandler<typeof deleteNewsPrefsRoute> = (c) => {
  deleteCookie(c, NEWS_COOKIE, { path: "/" });
  return c.json(DEFAULT_NEWS, 200);
};
