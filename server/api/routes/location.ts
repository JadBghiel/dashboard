/** user location: read, save, forget, a city search to pick one, and the consent to guess it from
 * the connection. in the user's settings in the db, signed in only (server/api/app.ts) */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";

import { SavedLocation, resolveSaved } from "@/server/location";
import { locationState, saveConsentOf, saveLocationOf } from "@/server/user-location";
import { geocode } from "@/server/services/weather/open-meteo";

import { errorResponse } from "../errors";
import { json, timeout, unauthorized, unavailable, userOf } from "../shared";

const LocationResponse = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  country: z.string(),
  source: z.enum(["saved", "ip", "default"]),
});

const locationOk = json("where the dashboard thinks you are, and how it knows", LocationResponse);

export const getLocationRoute = createRoute({
  method: "get",
  path: "/location",
  tags: ["location"],
  summary: "current location",
  responses: { 200: locationOk, ...unauthorized },
});

export const putLocationRoute = createRoute({
  method: "put",
  path: "/location",
  tags: ["location"],
  summary: "save a location",
  request: {
    body: { required: true, content: { "application/json": { schema: SavedLocation } } },
  },
  responses: {
    200: locationOk,
    400: errorResponse("the location is out of range"),
    ...unauthorized,
  },
});

export const deleteLocationRoute = createRoute({
  method: "delete",
  path: "/location",
  tags: ["location"],
  summary: "forget the saved location, back to the ip guess or the default city",
  responses: { 200: locationOk, ...unauthorized },
});

export const consentRoute = createRoute({
  method: "put",
  path: "/location/consent",
  tags: ["location"],
  summary: "allow or refuse guessing your city from your connection",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: z.object({ allow: z.boolean() }) } },
    },
  },
  responses: { 200: locationOk, ...unauthorized },
});

export const searchLocationRoute = createRoute({
  method: "get",
  path: "/location/search",
  tags: ["location"],
  summary: "find a city by name",
  request: { query: z.object({ q: z.string().trim().min(2).max(80) }) },
  responses: {
    200: json(
      "up to 5 matching places",
      z.object({
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
    ),
    400: errorResponse("the query is too short or too long"),
    ...unauthorized,
    502: errorResponse("the geocoding service is down"),
  },
});

export const getLocation: RouteHandler<typeof getLocationRoute> = async (c) =>
  c.json((await locationState(c.req.raw.headers)).location, 200);

export const putLocation: RouteHandler<typeof putLocationRoute> = async (c) => {
  const saved = c.req.valid("json");
  await saveLocationOf(await userOf(c), saved);
  // resolved like any later request will be, so the country fallback is the same
  const { consent } = await locationState(c.req.raw.headers);
  return c.json(resolveSaved(saved, c.req.raw.headers, consent === true), 200);
};

export const deleteLocation: RouteHandler<typeof deleteLocationRoute> = async (c) => {
  await saveLocationOf(await userOf(c), null);
  const { consent } = await locationState(c.req.raw.headers);
  return c.json(resolveSaved(null, c.req.raw.headers, consent === true), 200);
};

export const putConsent: RouteHandler<typeof consentRoute> = async (c) => {
  const { allow } = c.req.valid("json");
  await saveConsentOf(await userOf(c), allow);
  // the saved city stays first either way, the answer only changes the guess under it
  const { location } = await locationState(c.req.raw.headers);
  const saved = location.source === "saved" ? location : null;
  return c.json(resolveSaved(saved, c.req.raw.headers, allow), 200);
};

export const searchLocation: RouteHandler<typeof searchLocationRoute> = async (c) => {
  const { q } = c.req.valid("query");
  try {
    return c.json({ places: await geocode(q, timeout(c)) }, 200);
  } catch (err) {
    return unavailable(c, err, "City search");
  }
};
