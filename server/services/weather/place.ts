import { z } from "zod";

import { WidgetError, type UserLocation } from "@/server/registry/define";

import { geocode } from "./open-meteo";

// shared by both widgets, so "city" means the same thing everywhere: a name, or empty for the
// user location
export const cityParam = z.string().trim().max(80).default("").describe("Empty = where you are");
export const unitsParam = z.enum(["metric", "imperial"]).default("metric");

/** explicit city wins, empty means wherever the user is */
export async function resolvePlace(city: string, location: UserLocation, signal: AbortSignal) {
  if (!city) return { name: location.name, lat: location.lat, lon: location.lon };

  const [first] = await geocode(city, signal, 1);
  if (!first) throw new WidgetError(`No city called "${city}" was found.`);
  return { name: first.name, lat: first.lat, lon: first.lon };
}
