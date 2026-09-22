import { z } from "zod";

import { defineWidget } from "@/server/registry/define";

import { weatherReport } from "../open-meteo";
import { cityParam, resolvePlace, unitsParam } from "../place";

export const CurrentWeatherPayload = z.object({
  place: z.string(),
  // open wheater link
  lat: z.number(),
  lon: z.number(),
  units: z.enum(["metric", "imperial"]),
  temp: z.number(),
  feelsLike: z.number(),
  // wmo weather code
  code: z.number().int(),
  isDay: z.boolean(),
  humidity: z.number(),
  precipitation: z.number(),
  // null when the user turned show_wind off
  wind: z.number().nullable(),
  // the next days, today excluded, empty when days is 0
  days: z.array(
    z.object({
      // yyyy-mm-dd in the place's own timezone
      date: z.string(),
      code: z.number().int(),
      max: z.number(),
      min: z.number(),
    }),
  ),
});
export type CurrentWeatherPayload = z.infer<typeof CurrentWeatherPayload>;

export const currentWeatherWidget = defineWidget({
  id: "current_weather",
  name: "Weather",
  description: "Current conditions and the next days, for a city or for where you are",
  params: z.object({
    city: cityParam,
    units: unitsParam,
    show_wind: z.boolean().default(true),
    // 0 hides the strip, 7 is as far as openmeteo stays useful
    days: z.number().int().min(0).max(7).default(5),
  }),
  sizes: ["1x1", "2x1"],
  refresh: { default: 600, min: 300 },
  cache: { ttl: 600 },
  payload: CurrentWeatherPayload,
  async fetch({ params, location, signal }) {
    const place = await resolvePlace(params.city, location, signal);
    const report = await weatherReport(place.lat, place.lon, params.units, params.days, signal);
    return {
      place: place.name,
      lat: place.lat,
      lon: place.lon,
      units: params.units,
      temp: report.temp,
      feelsLike: report.feelsLike,
      code: report.code,
      isDay: report.isDay,
      humidity: report.humidity,
      precipitation: report.precipitation,
      wind: params.show_wind ? report.wind : null,
      days: report.days,
    };
  },
});
