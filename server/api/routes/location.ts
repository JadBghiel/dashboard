/** user location: read, save, forget, and a city search to pick one, in an
 * httpOnly cookie */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

import { LOCATION_COOKIE, SavedLocation, resolveLocation } from "@/server/location";
import { prefCookie } from "@/server/cookies";
import { geocode } from "@/server/services/weather/open-meteo";

import { errorResponse } from "../errors";

const LocationResponse = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  country: z.string(),
  source: z.enum(["saved", "ip", "default"]),
});

const locationOk = {
  description: "where the dashboard thinks you are, and how it knows",
  content: { "application/json": { schema: LocationResponse } },
};

export const getLocationRoute = createRoute({
  method: "get",
  path: "/location",
  tags: ["location"],
  summary: "current location",
  responses: { 200: locationOk },
});

export const putLocationRoute = createRoute({
  method: "put",
  path: "/location",
  tags: ["location"],
  summary: "save a location",
  request: {
    body: { required: true, content: { "application/json": { schema: SavedLocation } } },
  },
  responses: { 200: locationOk, 400: errorResponse("the location is out of range") },
});

export const deleteLocationRoute = createRoute({
  method: "delete",
  path: "/location",
  tags: ["location"],
  summary: "forget the saved location, back to the ip guess or the default city",
  responses: { 200: locationOk },
});

export const searchLocationRoute = createRoute({
  method: "get",
  path: "/location/search",
  tags: ["location"],
  summary: "find a city by name",
  request: { query: z.object({ q: z.string().trim().min(2).max(80) }) },
  responses: {
    200: {
      description: "up to 5 matching places",
      content: {
        "application/json": {
          schema: z.object({
            places: z.array(
              z.object({
                name: z.string(),
                country: z.string().optional(),
                countryCode: z.string().optional(),
                admin1: z.string().optional(),
                lat: z.number(),
                lon: z.number(),
              }),
            ),
          }),
        },
      },
    },
    400: errorResponse("the query is too short or too long"),
    502: errorResponse("the geocoding service is down"),
  },
});

const current = (c: Context) => resolveLocation(getCookie(c, LOCATION_COOKIE), c.req.raw.headers);

export const getLocation: RouteHandler<typeof getLocationRoute> = (c) => c.json(current(c), 200);

export const putLocation: RouteHandler<typeof putLocationRoute> = (c) => {
  const saved = c.req.valid("json");
  setCookie(c, LOCATION_COOKIE, JSON.stringify(saved), prefCookie(c.req.url));
  // resolved like any later request will be, so the country fallback is the same
  return c.json(resolveLocation(JSON.stringify(saved), c.req.raw.headers), 200);
};

export const deleteLocation: RouteHandler<typeof deleteLocationRoute> = (c) => {
  deleteCookie(c, LOCATION_COOKIE, { path: "/" });
  // resolved w/o the cookie we just removed, not from the request that still carries it
  return c.json(resolveLocation(undefined, c.req.raw.headers), 200);
};

export const searchLocation: RouteHandler<typeof searchLocationRoute> = async (c) => {
  const { q } = c.req.valid("query");
  try {
    const places = await geocode(q, AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(8000)]));
    return c.json({ places }, 200);
  } catch (err) {
    console.error("location search failed", err);
    return c.json(
      { code: "upstream_error", message: "City search is unavailable right now." },
      502,
    );
  }
};
