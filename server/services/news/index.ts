/** news: the headlines built from what the user cares about (google news rss), a world map of
 * earthquakes and natural events (usgs, nasa eonet) and live tv channels. all keyless */

import { z } from "zod";

import { CountryCode } from "@/server/location";
import { NEWS_LANGUAGES, NEWS_TOPICS } from "@/server/news-prefs";
import { defineService, defineWidget, WidgetError } from "@/server/registry/define";

import { fetchFeed, languageFor, type Feed } from "./google-news";
import { earthquakes, naturalEvents } from "./world-events";

export const HeadlinesPayload = z.object({
  country: z.string(),
  language: z.string(),
  // what the feed was built from, the card shows it under the title
  basedOn: z.array(z.string()),
  items: z.array(
    z.object({
      title: z.string(),
      source: z.string().nullable(),
      url: z.string(),
      publishedAt: z.number(),
      domain: z.string().nullable(),
      coverage: z.number(),
      from: z.string(),
    }),
  ),
});
export type HeadlinesPayload = z.infer<typeof HeadlinesPayload>;

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export const headlinesWidget = defineWidget({
  id: "headlines",
  usesLocation: true,
  name: "News",
  description: "Headlines from the topics and keywords you follow, in your country and language",
  // empty topics and keywords = the top stories, empty country = where the user is
  params: z.object({
    // comma separated: world, local, business, technology, science, health, sports, entertainment
    topics: z.string().trim().max(120).default(""),
    // comma separated searches
    keywords: z.string().trim().max(200).default(""),
    country: z.string().trim().max(2).default(""),
    language: z.enum(NEWS_LANGUAGES).optional(),
    count: z.number().int().min(3).max(20).optional(),
  }),
  refresh: { default: 900, min: 300 },
  cache: { ttl: 600 },
  payload: HeadlinesPayload,
  async fetch({ params, location, signal }) {
    const topicNames = list(params.topics);
    const topics = topicNames.flatMap((t) =>
      (NEWS_TOPICS as readonly string[]).includes(t) ? [t as (typeof NEWS_TOPICS)[number]] : [],
    );
    if (topics.length < topicNames.length) throw new WidgetError("Unknown news topic.");
    const keywords = list(params.keywords).slice(0, 5);

    // empty = where the user is
    const rawCountry = params.country || location.country;
    const country = CountryCode.safeParse(rawCountry);
    if (!country.success) throw new WidgetError("The country is a 2 letter code, like FR.");
    const language = params.language ?? languageFor(country.data);
    // even, the feed is 2 columns wide
    const count = params.count ?? 12;

    const feeds: Feed[] = [
      ...topics.map((topic) => ({ kind: "topic" as const, topic })),
      ...keywords.map((q) => ({ kind: "search" as const, q })),
    ];
    if (feeds.length === 0) feeds.push({ kind: "top" });

    const results = await Promise.allSettled(
      feeds.map((f) => fetchFeed(f, country.data, language, signal)),
    );
    const got = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    // 1 dead feed shouldnt blank the others, but if they all failed thats an outage
    if (got.length === 0) throw (results[0] as PromiseRejectedResult).reason;

    // round robin so 1 busy topic doesnt push the others out. each feed already comes in google's
    // own order (fresh and important first), a global sort by time would undo the balance
    const seen = new Set<string>();
    const merged = [];
    for (let i = 0; merged.length < count && got.some((g) => i < g.length); i++) {
      for (const articles of got) {
        const a = articles[i];
        const key = a?.title.toLowerCase();
        if (a && key && !seen.has(key)) {
          seen.add(key);
          merged.push(a);
        }
      }
    }
    const items = merged.slice(0, count);

    return {
      country: country.data,
      language,
      basedOn: feeds.map((f) =>
        f.kind === "top" ? "top stories" : f.kind === "topic" ? f.topic : `"${f.q}"`,
      ),
      items,
    };
  },
});

const WorldEventsPayload = z.object({
  window: z.enum(["day", "week"]),
  quakes: z.array(
    z.object({
      id: z.string(),
      lat: z.number(),
      lon: z.number(),
      mag: z.number(),
      place: z.string(),
      time: z.number(),
      url: z.string(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      category: z.string(),
      lat: z.number(),
      lon: z.number(),
      time: z.number(),
      url: z.string().nullable(),
    }),
  ),
});
export type WorldEventsPayload = z.infer<typeof WorldEventsPayload>;

export const worldEventsWidget = defineWidget({
  id: "world_events",
  name: "World map",
  description: "Earthquakes and natural events (wildfires, storms, volcanoes) on a world map",
  params: z.object({
    window: z.enum(["day", "week"]).default("day"),
    // the usgs feed starts at 4.5, 4 means all of it
    min_magnitude: z.number().int().min(4).max(7).default(5),
    show_natural: z.boolean().default(true),
  }),
  refresh: { default: 600, min: 300 },
  cache: { ttl: 600 },
  payload: WorldEventsPayload,
  async fetch({ params, signal }) {
    const [quakes, events] = await Promise.all([
      earthquakes(params.window, signal),
      params.show_natural ? naturalEvents(params.window, signal) : Promise.resolve([]),
    ]);
    return {
      window: params.window,
      quakes: quakes.filter((q) => q.mag >= params.min_magnitude),
      events,
    };
  },
});

// 24/7 news channels whose youtube live stream can be embedded. france 24 and euronews refuse
// embedding, so they arent offered
export const LIVE_CHANNELS = {
  aljazeera: { name: "Al Jazeera", youtube: "UCNye-wNBqNL5ZzHSJj3l8Bg" },
  dw: { name: "DW News", youtube: "UCknLrEdhRCp1aegoMqRaCZg" },
  sky: { name: "Sky News", youtube: "UCoMdktPbSTixAyNGwb-UYkQ" },
  bloomberg: { name: "Bloomberg", youtube: "UCIALMKvObZNtJ6AmdCLP7Lg" },
} as const;
type ChannelId = keyof typeof LIVE_CHANNELS;

const LiveTvPayload = z.object({
  selected: z.string(),
  channels: z.array(z.object({ id: z.string(), name: z.string(), youtube: z.string() })),
});
export type LiveTvPayload = z.infer<typeof LiveTvPayload>;

export const liveTvWidget = defineWidget({
  id: "live_tv",
  name: "Live TV",
  description: "24/7 news channels, live, 1 click to play",
  params: z.object({
    channel: z.enum(Object.keys(LIVE_CHANNELS) as [ChannelId, ...ChannelId[]]).default("aljazeera"),
  }),
  refresh: { default: 86_400, min: 3600 },
  cache: { ttl: 86_400 },
  payload: LiveTvPayload,
  // nothing to fetch, the stream plays straight from youtube in the browser
  async fetch({ params }) {
    return {
      selected: params.channel,
      channels: Object.entries(LIVE_CHANNELS).map(([id, c]) => ({ id, ...c })),
    };
  },
});

export const news = defineService({
  id: "news",
  name: "News",
  description: "Your headlines, from the topics and keywords you follow",
  category: "news",
  auth: "none",
  widgets: [headlinesWidget, worldEventsWidget, liveTvWidget],
});
