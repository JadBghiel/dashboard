/** what's happening on the map: earthquakes from the usgs and natural events (wildfires, storms,
 * volcanoes, sea ice) from nasa's eonet. both keyless, both plain points w/ a time */

import { z } from "zod";

import { getJson, ttlCache } from "../http";

export type TimeWindow = "day" | "week";

export type Quake = {
  id: string;
  lat: number;
  lon: number;
  mag: number;
  place: string;
  // unix seconds
  time: number;
  url: string;
};

export type NaturalEvent = {
  id: string;
  title: string;
  category: string;
  lat: number;
  lon: number;
  time: number;
  url: string | null;
};

const QuakeFeed = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      properties: z.object({
        mag: z.number().nullable(),
        place: z.string().nullable(),
        time: z.number(),
        url: z.string(),
      }),
      geometry: z.object({ coordinates: z.array(z.number()).min(2) }),
    }),
  ),
});

const EventFeed = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      categories: z.array(z.object({ id: z.string() })).min(1),
      sources: z.array(z.object({ url: z.string() })),
      geometry: z
        .array(
          z.object({
            date: z.string(),
            type: z.string(),
            coordinates: z.unknown(),
          }),
        )
        .min(1),
    }),
  ),
});

const quakeCache = ttlCache<Quake[]>(10 * 60_000);
const eventCache = ttlCache<NaturalEvent[]>(30 * 60_000);

/** m4.5+ over the last day or week, the usgs publishes both as ready made feeds */
export async function earthquakes(window: TimeWindow, signal: AbortSignal): Promise<Quake[]> {
  const hit = quakeCache.get(window);
  if (hit) return hit;
  const url = new URL(
    `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_${window}.geojson`,
  );
  const feed = QuakeFeed.parse(await getJson(url, { signal, what: "usgs" }));
  const quakes = feed.features.flatMap((f) => {
    const [lon, lat] = f.geometry.coordinates;
    if (f.properties.mag == null) return [];
    return [
      {
        id: f.id,
        lat,
        lon,
        mag: f.properties.mag,
        place: f.properties.place ?? "Unknown place",
        time: Math.floor(f.properties.time / 1000),
        url: f.properties.url,
      },
    ];
  });
  quakeCache.set(window, quakes);
  return quakes;
}

// a point is [lon, lat], a polygon is [[[lon, lat], ...]]: the 1st corner is close enough on a
// world map
function firstPoint(coords: unknown): [number, number] | null {
  let c = coords;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number"
    ? [c[0], c[1]]
    : null;
}

/** open eonet events active in the window. each keeps its latest position (a storm moves) */
export async function naturalEvents(
  window: TimeWindow,
  signal: AbortSignal,
): Promise<NaturalEvent[]> {
  const hit = eventCache.get(window);
  if (hit) return hit;
  const url = new URL("https://eonet.gsfc.nasa.gov/api/v3/events");
  url.searchParams.set("status", "open");
  url.searchParams.set("days", window === "day" ? "1" : "7");
  const feed = EventFeed.parse(await getJson(url, { signal, what: "eonet" }));
  const events = feed.events.flatMap((e) => {
    const last = e.geometry[e.geometry.length - 1];
    const point = firstPoint(last.coordinates);
    if (!point) return [];
    const time = Date.parse(last.date);
    const source = e.sources.find((s) => s.url.startsWith("https://"))?.url ?? null;
    return [
      {
        id: e.id,
        title: e.title,
        category: e.categories[0].id,
        lon: point[0],
        lat: point[1],
        time: Number.isFinite(time) ? Math.floor(time / 1000) : 0,
        url: source,
      },
    ];
  });
  eventCache.set(window, events);
  return events;
}
