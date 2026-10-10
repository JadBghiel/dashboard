/** 4 keyless upstreams behind the tools service: nager.date (holidays), mymemory (translation),
 * wikipedia (on this day), all parsed with zod */

import { z } from "zod";

import { WidgetError } from "@/server/registry/define";

import { getJson, ttlCache, UpstreamError } from "../http";

// ---- holidays ----

const HolidaysResponse = z.array(
  z.object({
    date: z.string(),
    localName: z.string(),
    name: z.string(),
    global: z.boolean(),
    counties: z.array(z.string()).nullable(),
  }),
);

export type Holiday = { date: string; name: string; localName: string; regional: boolean };

// the dates of the next holidays dont move during a day
const holidayCache = ttlCache<Holiday[]>(24 * 60 * 60_000);

export async function nextHolidays(country: string, signal: AbortSignal): Promise<Holiday[]> {
  const hit = holidayCache.get(country);
  if (hit) return hit;
  const url = new URL(`https://date.nager.at/api/v3/NextPublicHolidays/${country}`);
  try {
    const rows = HolidaysResponse.parse(await getJson(url, { signal, what: "nager.date" }));
    const holidays = rows.map((h) => ({
      date: h.date,
      name: h.name,
      localName: h.localName,
      // only part of the country, a single region or county
      regional: !h.global,
    }));
    holidayCache.set(country, holidays);
    return holidays;
  } catch (err) {
    // nager answers 500 or 404 for a country it doesnt cover
    if (err instanceof UpstreamError && [404, 500].includes(err.status)) {
      throw new WidgetError(`No holiday calendar for ${country}.`);
    }
    throw err;
  }
}

// ---- translation ----

export const LANGUAGES = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  ar: "Arabic",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
} as const;
export type Language = keyof typeof LANGUAGES;
export const languageCodes = Object.keys(LANGUAGES) as [Language, ...Language[]];

const TranslateResponse = z.object({
  responseData: z.object({ translatedText: z.string().nullable() }),
  responseStatus: z.union([z.number(), z.string()]),
  quotaFinished: z.boolean().nullable().optional(),
});

const translationCache = ttlCache<string>(24 * 60 * 60_000, 1000);

export async function translate(text: string, from: Language, to: Language, signal: AbortSignal) {
  if (from === to) return text;
  const key = `${from}|${to}|${text}`;
  const hit = translationCache.get(key);
  if (hit) return hit;

  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${from}|${to}`);
  // machine translation only. the public memory of past human translations is full of junk
  // (asked "what time is it?", its top answer was "i study at the library")
  url.searchParams.set("onlyprivate", "1");
  url.searchParams.set("mt", "1");
  // w/ an email mymemory raises the free quota from 5k to 50k characters a day
  if (process.env.MYMEMORY_EMAIL) url.searchParams.set("de", process.env.MYMEMORY_EMAIL);

  const body = TranslateResponse.parse(await getJson(url, { signal, what: "mymemory" }));
  if (body.quotaFinished || Number(body.responseStatus) === 429) {
    throw new WidgetError("The free translation quota is used up for today.");
  }
  if (Number(body.responseStatus) !== 200) {
    throw new UpstreamError("mymemory", Number(body.responseStatus));
  }
  const translated = body.responseData.translatedText;
  if (!translated) throw new UpstreamError("mymemory", 204);
  translationCache.set(key, translated);
  return translated;
}

// ---- on this day ----

export const WIKI_LANGUAGES = ["en", "fr", "es", "de", "it", "pt"] as const;

const OnThisDayResponse = z.record(
  z.string(),
  z.array(
    z.object({
      text: z.string(),
      year: z.number().optional(),
      pages: z
        .array(
          z.object({
            content_urls: z
              .object({ desktop: z.object({ page: z.string() }).optional() })
              .optional(),
          }),
        )
        .optional(),
    }),
  ),
);

export type HistoryEntry = { year: number | null; text: string; url: string | null };

const historyCache = ttlCache<HistoryEntry[]>(60 * 60_000);

export async function onThisDay(
  type: "events" | "births" | "deaths",
  language: string,
  month: number,
  day: number,
  signal: AbortSignal,
): Promise<HistoryEntry[]> {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const key = `${language}|${type}|${mm}${dd}`;
  const hit = historyCache.get(key);
  if (hit) return hit;

  const url = new URL(
    `https://api.wikimedia.org/feed/v1/wikipedia/${language}/onthisday/${type}/${mm}/${dd}`,
  );
  const body = OnThisDayResponse.parse(await getJson(url, { signal, what: "wikipedia" }));
  const entries = (body[type] ?? []).map((e) => ({
    year: e.year ?? null,
    text: e.text,
    url: e.pages?.[0]?.content_urls?.desktop?.page ?? null,
  }));
  historyCache.set(key, entries);
  return entries;
}
