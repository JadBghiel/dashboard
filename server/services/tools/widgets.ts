/** the tools widgets. the translator is interactive: its fetch only returns the config the card
 * needs, the actual work goes through /api/tools/translate */

import { z } from "zod";

import { CountryCode } from "@/server/location";
import { defineWidget, WidgetError } from "@/server/registry/define";

import { LANGUAGES, languageCodes, nextHolidays, onThisDay, WIKI_LANGUAGES } from "./upstreams";

// ---- holidays ----

export const HolidaysPayload = z.object({
  country: z.string(),
  items: z.array(
    z.object({
      date: z.string(),
      name: z.string(),
      localName: z.string(),
      regional: z.boolean(),
    }),
  ),
});
export type HolidaysPayload = z.infer<typeof HolidaysPayload>;

export const holidaysWidget = defineWidget({
  id: "public_holidays",
  usesLocation: true,
  name: "Public holidays",
  description: "The next public holidays, in your country or any other",
  params: z.object({
    // iso code like FR or US. empty = the country you're in
    country: z
      .string()
      .trim()
      .max(2)
      .default("")
      .describe("Empty = where you are, or a code like FR"),
    count: z.number().int().min(1).max(10).default(5),
  }),
  refresh: { default: 86_400, min: 3600 },
  cache: { ttl: 86_400 },
  payload: HolidaysPayload,
  async fetch({ params, location, signal }) {
    const code = params.country ? CountryCode.safeParse(params.country) : null;
    if (code && !code.success) throw new WidgetError("The country is a 2 letter code, like FR.");
    const country = code?.data ?? location.country;
    const items = await nextHolidays(country, signal);
    return { country, items: items.slice(0, params.count) };
  },
});

// ---- translator ----

export const TranslatorPayload = z.object({
  from: z.string(),
  to: z.string(),
  languages: z.array(z.object({ code: z.string(), name: z.string() })),
});
export type TranslatorPayload = z.infer<typeof TranslatorPayload>;

export const translatorWidget = defineWidget({
  id: "translator",
  name: "Translator",
  description: "Translate a short text between 12 languages",
  params: z.object({
    from: z.enum(languageCodes).default("en"),
    to: z.enum(languageCodes).default("fr"),
  }),
  // nothing to refresh, the text is what changes
  refresh: { default: 86_400, min: 3600 },
  cache: { ttl: 86_400 },
  payload: TranslatorPayload,
  async fetch({ params }) {
    return {
      from: params.from,
      to: params.to,
      languages: Object.entries(LANGUAGES).map(([code, name]) => ({ code, name })),
    };
  },
});

// ---- on this day ----

export const OnThisDayPayload = z.object({
  // "September 24" in the widget language
  day: z.string(),
  type: z.enum(["events", "births", "deaths"]),
  items: z.array(
    z.object({ year: z.number().nullable(), text: z.string(), url: z.string().nullable() }),
  ),
});
export type OnThisDayPayload = z.infer<typeof OnThisDayPayload>;

/** wikipedia sorts newest first, `count` entries spread over the whole list read better than the
 * last 5 years */
function spread<T>(list: T[], count: number) {
  if (list.length <= count) return list;
  const step = list.length / count;
  return Array.from({ length: count }, (_, i) => list[Math.floor(i * step)]);
}

export const onThisDayWidget = defineWidget({
  id: "on_this_day",
  name: "On this day",
  description: "What happened on today's date in history, from Wikipedia",
  params: z.object({
    type: z.enum(["events", "births", "deaths"]).default("events"),
    count: z.number().int().min(1).max(10).default(5),
    language: z.enum(WIKI_LANGUAGES).default("en"),
  }),
  refresh: { default: 3600, min: 600 },
  cache: { ttl: 3600 },
  payload: OnThisDayPayload,
  async fetch({ params, signal }) {
    const now = new Date();
    const entries = await onThisDay(
      params.type,
      params.language,
      now.getUTCMonth() + 1,
      now.getUTCDate(),
      signal,
    );
    return {
      day: now.toLocaleDateString(params.language, {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
      type: params.type,
      items: spread(entries, params.count),
    };
  },
});
