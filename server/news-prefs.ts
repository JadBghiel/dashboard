/** what the user wants in their news, kept in an httpOnly cookie until accounts exist, then it moves
 * into the saved widget. same idea as the location and the watchlist: the server reads it on every
 * request, so the news widget knows the user's taste w/o the browser sending it */

import { z } from "zod";

import { CountryCode } from "./location";

export const NEWS_COOKIE = "dash_news";

export const NEWS_TOPICS = [
  "world",
  "local",
  "business",
  "technology",
  "science",
  "health",
  "sports",
  "entertainment",
] as const;
export type NewsTopic = (typeof NEWS_TOPICS)[number];

export const NEWS_LANGUAGES = ["en", "fr", "es", "de", "it", "pt", "nl", "ja", "ko"] as const;
export type NewsLanguage = (typeof NEWS_LANGUAGES)[number];

export const NewsPrefs = z.object({
  topics: z.array(z.enum(NEWS_TOPICS)).max(NEWS_TOPICS.length),
  // free text searches, each its own feed
  keywords: z.array(z.string().trim().min(2).max(40)).max(5),
  // empty = the country you're in
  country: z.union([CountryCode, z.literal("")]),
  // empty = the country's own language
  language: z.union([z.enum(NEWS_LANGUAGES), z.literal("")]),
  count: z.number().int().min(3).max(20),
});
export type NewsPrefs = z.infer<typeof NewsPrefs>;

export const DEFAULT_NEWS: NewsPrefs = {
  topics: [],
  keywords: [],
  country: "",
  language: "",
  // even, the feed is 2 columns wide
  count: 12,
};
