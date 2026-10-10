/** user location: read, save, forget, a city search to pick one, and the consent to guess it from
 * the connection. in the user's settings in the db, or httpOnly cookies for a visitor */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

import { currentUserId } from "@/server/auth/current-user";
import { CONSENT_COOKIE, LOCATION_COOKIE, SavedLocation, resolveSaved } from "@/server/location";
import { locationState, saveConsentOf, saveLocationOf } from "@/server/user-location";
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

const state = (c: Context) => locationState(c.req.raw.headers, (name) => getCookie(c, name));

export const getLocation: RouteHandler<typeof getLocationRoute> = async (c) =>
  c.json((await state(c)).location, 200);

// a signed in user's city goes in their settings in the db, a visitor's in a cookie
export const putLocation: RouteHandler<typeof putLocationRoute> = async (c) => {
  const saved = c.req.valid("json");
  const userId = await currentUserId(c.req.raw.headers);
  if (userId) await saveLocationOf(userId, saved);
  else setCookie(c, LOCATION_COOKIE, JSON.stringify(saved), prefCookie(c.req.url));
  // resolved like any later request will be, so the country fallback is the same
  const { consent } = await state(c);
  return c.json(resolveSaved(saved, c.req.raw.headers, consent === true), 200);
};

export const deleteLocation: RouteHandler<typeof deleteLocationRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (userId) await saveLocationOf(userId, null);
  else deleteCookie(c, LOCATION_COOKIE, { path: "/" });
  // resolved w/o what we just removed, not from the request that still carries it
  const { consent } = await state(c);
  return c.json(resolveSaved(null, c.req.raw.headers, consent === true), 200);
};

export const putConsent: RouteHandler<typeof consentRoute> = async (c) => {
  const { allow } = c.req.valid("json");
  const userId = await currentUserId(c.req.raw.headers);
  if (userId) await saveConsentOf(userId, allow);
  else setCookie(c, CONSENT_COOKIE, allow ? "yes" : "no", prefCookie(c.req.url));
  // the saved city stays first either way, the answer only changes the guess under it
  const { location } = await state(c);
  const saved = location.source === "saved" ? location : null;
  return c.json(resolveSaved(saved, c.req.raw.headers, allow), 200);
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
