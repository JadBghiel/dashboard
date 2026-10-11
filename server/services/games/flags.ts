/** flag guesser: 1 country a day, guess it from its flag. flags from flagcdn, positions from
 * countriesnow, both keyless. each miss tells how far and in which direction the answer is */

import { z } from "zod";

import { WidgetError } from "@/server/registry/define";

import { fetchOnceMore, getJson, ttlCache, UpstreamError } from "../http";
import { today } from "@/lib/day";

import { pickDaily, puzzleNumber } from "./daily";

export type Country = { code: string; name: string; lat: number; lon: number };

export type FlagGuess = {
  code: string;
  name: string;
  correct: boolean;
  // null when hints are off or the country has no known position
  distanceKm: number | null;
  // compass bearing from the guess to the answer, 0 = north
  bearing: number | null;
};

export type FlagState = {
  day: string;
  number: number;
  maxGuesses: number;
  hints: boolean;
  guesses: FlagGuess[];
  status: "playing" | "won" | "lost";
  // only once the game is over
  answer: { code: string; name: string } | null;
  // every country, for the autocomplete. the answer is 1 of them, so it gives nothing away
  countries: { code: string; name: string }[];
};

export const FlagProgress = z.object({
  day: z.string(),
  guesses: z.array(z.string().regex(/^[a-z]{2}$/)).max(8),
});
export type FlagProgress = z.infer<typeof FlagProgress>;

// not countries: they have a flag on flagcdn but dont belong in a country quiz
const NOT_COUNTRIES = new Set(["eu", "un"]);

// the flagcdn countries countriesnow has no position for, rough centers
const POSITION_FALLBACK: Record<string, [number, number]> = {
  gr: [39, 22],
  ss: [7, 30],
  xk: [42.6, 20.9],
  cw: [12.2, -69],
  bq: [12.2, -68.3],
  sx: [18, -63.1],
  mf: [18.1, -63.1],
  bl: [17.9, -62.8],
  ax: [60.2, 20],
  gf: [4, -53],
};

const Codes = z.record(z.string(), z.string());
const Positions = z.object({
  // some rows come w/ the coordinates as strings ("12.5"), coerce takes both
  data: z.array(z.object({ iso2: z.string(), lat: z.coerce.number(), long: z.coerce.number() })),
});

const countriesCache = ttlCache<Country[]>(24 * 60 * 60_000);

export async function countries(signal: AbortSignal): Promise<Country[]> {
  const hit = countriesCache.get("all");
  if (hit) return hit;
  const [codes, positions] = await Promise.all([
    getJson(new URL("https://flagcdn.com/en/codes.json"), { signal, what: "flagcdn" }),
    getJson(new URL("https://countriesnow.space/api/v0.1/countries/positions"), {
      signal,
      what: "countriesnow",
    }),
  ]);
  const byCode = new Map(
    Positions.parse(positions).data.map((p) => [p.iso2.toLowerCase(), [p.lat, p.long] as const]),
  );
  const list = Object.entries(Codes.parse(codes)).flatMap(([code, name]) => {
    if (code.length !== 2 || NOT_COUNTRIES.has(code)) return [];
    const pos = byCode.get(code) ?? POSITION_FALLBACK[code];
    return pos ? [{ code, name, lat: pos[0], lon: pos[1] }] : [];
  });
  list.sort((a, b) => a.name.localeCompare(b.name));
  countriesCache.set("all", list);
  return list;
}

const dailyCountry = async (signal: AbortSignal) => pickDaily(await countries(signal), "flag");

const toRad = (d: number) => (d * Math.PI) / 180;

function distanceKm(a: Country, b: Country) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
}

function bearing(a: Country, b: Country) {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

export async function flagState(
  progress: FlagProgress | null,
  maxGuesses: number,
  hints: boolean,
  signal: AbortSignal,
): Promise<FlagState> {
  const all = await countries(signal);
  const answer = pickDaily(all, "flag");
  const byCode = new Map(all.map((c) => [c.code, c]));
  const codes = progress && progress.day === today() ? progress.guesses : [];

  const guesses = codes.flatMap((code) => {
    const c = byCode.get(code);
    if (!c) return [];
    const correct = code === answer.code;
    return [
      {
        code,
        name: c.name,
        correct,
        distanceKm: hints && !correct ? distanceKm(c, answer) : null,
        bearing: hints && !correct ? bearing(c, answer) : null,
      },
    ];
  });
  const won = guesses.some((g) => g.correct);
  const status = won ? "won" : guesses.length >= maxGuesses ? "lost" : "playing";
  return {
    day: today(),
    number: puzzleNumber(),
    maxGuesses,
    hints,
    guesses,
    status,
    answer: status === "playing" ? null : { code: answer.code, name: answer.name },
    countries: all.map(({ code, name }) => ({ code, name })),
  };
}

// "cote divoire", "ivory coast" and "Côte d'Ivoire (Ivory Coast)" all find the same country:
// accents, case and punctuation dont count, and the name in brackets is an alias
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const namesOf = (name: string) => {
  const alias = name.match(/^(.*?)\s*\((.+)\)$/);
  return alias ? [name, alias[1], alias[2]] : [name];
};

export function playFlag(state: FlagState, raw: string): FlagProgress {
  if (state.status !== "playing")
    throw new WidgetError("Today's game is over, come back tomorrow.");
  const q = fold(raw);
  const match = state.countries.find(
    (c) => c.code === raw.trim().toLowerCase() || namesOf(c.name).some((n) => fold(n) === q),
  );
  if (!match) throw new WidgetError("Pick a country from the list.");
  if (state.guesses.some((g) => g.code === match.code)) throw new WidgetError("Already tried.");
  return { day: state.day, guesses: [...state.guesses.map((g) => g.code), match.code] };
}

/** the day's flag as an image, fetched here so its file name (the country code) never reaches the
 * page */
export async function dailyFlagImage(signal: AbortSignal) {
  const { code } = await dailyCountry(signal);
  const res = await fetchOnceMore(new URL(`https://flagcdn.com/w320/${code}.png`), { signal });
  if (!res.ok) throw new UpstreamError("flagcdn", res.status);
  return res.arrayBuffer();
}
