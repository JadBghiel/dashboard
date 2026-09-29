/** google news rss: every outlet's headlines, keyless, by topic, by search, by country and language.
 * 1 feed per topic or keyword, cached 10 min per feed */

import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import type { NewsLanguage, NewsTopic } from "@/server/news-prefs";

import { getText, ttlCache } from "../http";

const BASE_URL = "https://news.google.com/rss";

// google's topic ids. "local" is what google calls NATION, the news of your own country
const TOPIC_IDS: Record<NewsTopic, string> = {
  world: "WORLD",
  local: "NATION",
  business: "BUSINESS",
  technology: "TECHNOLOGY",
  science: "SCIENCE",
  health: "HEALTH",
  sports: "SPORTS",
  entertainment: "ENTERTAINMENT",
};

// the language google publishes an edition in, for the countries we default on. anything else falls
// back on english, and google itself falls back on its us edition for a pair it doesnt have
// prettier-ignore
const COUNTRY_LANGUAGE: Record<string, NewsLanguage> = {
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es",
  FR: "fr", BE: "fr", CH: "fr",
  DE: "de", AT: "de",
  IT: "it",
  PT: "pt", BR: "pt",
  NL: "nl",
  JP: "ja",
  KR: "ko",
};
export const languageFor = (country: string): NewsLanguage => COUNTRY_LANGUAGE[country] ?? "en";

export type Feed =
  { kind: "top" } | { kind: "topic"; topic: NewsTopic } | { kind: "search"; q: string };

export type Article = {
  title: string;
  source: string | null;
  url: string;
  // unix seconds
  publishedAt: number;
  // which topic or keyword brought it, shown as a small tag
  from: string;
  // the publisher's site, for its logo. the feed has no article images
  domain: string | null;
  // how many other outlets cover the same story, 0 when the feed doesnt say
  coverage: number;
};

const Item = z.object({
  title: z.string(),
  link: z.string(),
  pubDate: z.string().optional(),
  source: z
    .union([z.string(), z.object({ "#text": z.string(), "@_url": z.string().optional() })])
    .optional(),
  // html: the story's related coverage as an <ol>, 1 <li> per outlet
  description: z.string().optional(),
});

function domainOf(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// parseTagValue off: a headline like "2026" must stay a string, not become a number. attributes on,
// the publisher's site is <source url="…">
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  isArray: (name) => name === "item",
});

const cache = ttlCache<Article[]>(10 * 60_000);

function feedUrl(feed: Feed, country: string, language: string) {
  const url =
    feed.kind === "top"
      ? new URL(BASE_URL)
      : feed.kind === "topic"
        ? new URL(`${BASE_URL}/headlines/section/topic/${TOPIC_IDS[feed.topic]}`)
        : new URL(`${BASE_URL}/search`);
  if (feed.kind === "search") url.searchParams.set("q", feed.q);
  url.searchParams.set("hl", `${language}-${country}`);
  url.searchParams.set("gl", country);
  url.searchParams.set("ceid", `${country}:${language}`);
  return url;
}

const label = (feed: Feed) =>
  feed.kind === "top" ? "top" : feed.kind === "topic" ? feed.topic : feed.q;

export async function fetchFeed(
  feed: Feed,
  country: string,
  language: string,
  signal: AbortSignal,
): Promise<Article[]> {
  const url = feedUrl(feed, country, language);
  const key = url.toString();
  const hit = cache.get(key);
  if (hit) return hit;

  const xml = await getText(url, { signal, what: "google news" });
  const doc = parser.parse(xml);
  const items = z.array(Item).parse(doc?.rss?.channel?.item ?? []);

  const articles = items.flatMap((item) => {
    // only real links out, a feed shouldnt be able to inject a javascript: url into the page
    if (!item.link.startsWith("https://")) return [];
    const source = typeof item.source === "string" ? item.source : (item.source?.["#text"] ?? null);
    // google appends " - Source" to every title
    const title =
      source && item.title.endsWith(` - ${source}`)
        ? item.title.slice(0, -(source.length + 3))
        : item.title;
    const time = item.pubDate ? Date.parse(item.pubDate) : NaN;
    return [
      {
        title,
        source,
        url: item.link,
        publishedAt: Number.isFinite(time) ? Math.floor(time / 1000) : 0,
        from: label(feed),
        domain: typeof item.source === "object" ? domainOf(item.source["@_url"]) : null,
        coverage: Math.max(0, (item.description?.match(/<li>/g)?.length ?? 0) - 1),
      },
    ];
  });

  cache.set(key, articles);
  return articles;
}
