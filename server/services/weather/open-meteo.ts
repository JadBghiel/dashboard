/** open-meteo: https, no key, and geocoding included,  answers are parsed w/ zod, and a failure
 * throws a plain Error whose text stays in the server logs, runWidget turns it into a generic
 * "unavailable" for the user */

import { z } from "zod";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export type Units = "metric" | "imperial";

export type Place = { name: string; country?: string; admin1?: string; lat: number; lon: number };

const GeocodingResponse = z.object({
  // absent, not empty, when nothing matches
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
      }),
    )
    .optional(),
});

const ReportResponse = z.object({
  current: z.object({
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    weather_code: z.number().int(),
    wind_speed_10m: z.number(),
    relative_humidity_2m: z.number(),
    precipitation: z.number(),
    is_day: z.number().int(),
  }),
  // only there when days > 0
  daily: z
    .object({
      time: z.array(z.string()),
      weather_code: z.array(z.number().int()),
      temperature_2m_max: z.array(z.number()),
      temperature_2m_min: z.array(z.number()),
    })
    .optional(),
});

async function getJson(url: URL, signal: AbortSignal): Promise<unknown> {
  const res = await fetchOnceMore(url, signal);
  if (!res.ok) throw new Error(`open-meteo ${url.pathname} answered ${res.status}`);
  return res.json();
}

// a cold first connection sometimes times out (seen in dev: ETIMEDOUT, then fine right after). 1
// retry on a network failure only
async function fetchOnceMore(url: URL, signal: AbortSignal) {
  const init = { signal, headers: { accept: "application/json" } };
  try {
    return await fetch(url, init);
  } catch (err) {
    if (signal.aborted) throw err;
    return fetch(url, init);
  }
}

const unitParams = (url: URL, units: Units) => {
  if (units === "imperial") {
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
  }
};

// geocoding is cached way longer than the weather, per server instance, in
// memory, capped so a flood of random queries cant grow it forever
const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_MAX = 500;
const geoCache = new Map<string, { at: number; places: Place[] }>();

export async function geocode(query: string, signal: AbortSignal, count = 5): Promise<Place[]> {
  const key = `${query.toLowerCase()}|${count}`;
  const hit = geoCache.get(key);
  if (hit && Date.now() - hit.at < GEO_TTL_MS) return hit.places;

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const { results = [] } = GeocodingResponse.parse(await getJson(url, signal));
  const places = results.map((r) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    lat: r.latitude,
    lon: r.longitude,
  }));

  if (geoCache.size >= GEO_MAX) geoCache.delete(geoCache.keys().next().value!);
  geoCache.set(key, { at: Date.now(), places });
  return places;
}

/** current conditions + the next `days` days, in 1 call. today is left out of the days, its already
 * what "current" shows */
export async function weatherReport(
  lat: number,
  lon: number,
  units: Units,
  days: number,
  signal: AbortSignal,
) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,precipitation,is_day",
  );
  if (days > 0) {
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
    // +1 bc the 1st day open-meteo sends back is today
    url.searchParams.set("forecast_days", String(days + 1));
  }
  url.searchParams.set("timezone", "auto");
  unitParams(url, units);

  const { current, daily } = ReportResponse.parse(await getJson(url, signal));
  return {
    temp: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    code: current.weather_code,
    isDay: current.is_day === 1,
    wind: current.wind_speed_10m,
    humidity: current.relative_humidity_2m,
    precipitation: current.precipitation,
    days: (daily?.time ?? []).slice(1, days + 1).map((date, i) => ({
      date,
      code: daily!.weather_code[i + 1],
      max: daily!.temperature_2m_max[i + 1],
      min: daily!.temperature_2m_min[i + 1],
    })),
  };
}
