/** spelling bee: 7 letters a day, make words w/ the center letter in them. the letters come from a
 * common 7 letter word w/ 7 different letters (the pangram), so there is always 1 word using them
 * all. words are checked against datamuse, no full answer list, so no "x words left" */

import { z } from "zod";

import { WidgetError } from "@/server/registry/define";

import { pickDaily, puzzleNumber, today } from "./daily";
import { wordFrequency, wordsOfLength } from "./words";

export type BeeState = {
  day: string;
  number: number;
  center: string;
  // the 6 others, alphabetical
  letters: string[];
  minLength: number;
  found: { word: string; points: number; pangram: boolean }[];
  score: number;
  rank: string;
};

export const BeeProgress = z.object({
  day: z.string(),
  found: z.array(z.string().regex(/^[a-z]{4,15}$/)).max(200),
});
export type BeeProgress = z.infer<typeof BeeProgress>;

const RANKS: [number, string][] = [
  [0, "Beginner"],
  [5, "Good start"],
  [15, "Solid"],
  [30, "Nice"],
  [50, "Great"],
  [80, "Amazing"],
  [120, "Genius"],
];
const rankFor = (score: number) => RANKS.filter(([min]) => score >= min).at(-1)![1];

async function puzzle(signal: AbortSignal) {
  const words = await wordsOfLength(7, signal);
  const pangrams = words
    .filter((w) => w.freq >= 2 && new Set(w.word).size === 7 && !w.word.endsWith("s"))
    .map((w) => w.word);
  if (pangrams.length === 0) throw new Error("no pangram candidates");
  const pangram = pickDaily(pangrams, "bee");
  const letters = [...new Set(pangram)];
  const center = pickDaily(letters, "bee-center");
  // alphabetical, the pangram's own order would spell the answer out
  return { center, others: letters.filter((l) => l !== center).sort() };
}

const points = (word: string, pangram: boolean) =>
  (word.length === 4 ? 1 : word.length) + (pangram ? 7 : 0);

export async function beeState(
  progress: BeeProgress | null,
  minLength: number,
  signal: AbortSignal,
): Promise<BeeState> {
  const { center, others } = await puzzle(signal);
  const all = new Set([center, ...others]);
  const words = progress && progress.day === today() ? progress.found : [];
  const found = words.map((word) => {
    const pangram = [...all].every((l) => word.includes(l));
    return { word, points: points(word, pangram), pangram };
  });
  const score = found.reduce((s, f) => s + f.points, 0);
  return {
    day: today(),
    number: puzzleNumber(),
    center,
    letters: others,
    minLength,
    found,
    score,
    rank: rankFor(score),
  };
}

export async function playBee(
  state: BeeState,
  raw: string,
  signal: AbortSignal,
): Promise<BeeProgress> {
  const word = raw.trim().toLowerCase();
  const allowed = new Set([state.center, ...state.letters]);
  if (!/^[a-z]+$/.test(word)) throw new WidgetError("Letters only.");
  if (word.length < state.minLength)
    throw new WidgetError(`Too short, ${state.minLength} letters at least.`);
  if (word.length > 15) throw new WidgetError("Too long.");
  if (!word.includes(state.center)) {
    throw new WidgetError(`Missing the center letter ${state.center.toUpperCase()}.`);
  }
  const bad = [...word].find((l) => !allowed.has(l));
  if (bad) throw new WidgetError(`${bad.toUpperCase()} isn't one of today's letters.`);
  if (state.found.some((f) => f.word === word)) throw new WidgetError("Already found.");
  // 0.05 per million: real words, not the typos and abbreviations datamuse also knows
  if ((await wordFrequency(word, signal)) < 0.05) throw new WidgetError("Not in the word list.");
  return { day: state.day, found: [...state.found.map((f) => f.word), word] };
}
