/** wordle: 1 common word a day, 6 tries. the answer never leaves the server until the game is over,
 * every guess is scored here, so reading the network tab doesnt give it away */

import { z } from "zod";

import { WidgetError } from "@/server/registry/define";

import { pickDaily, puzzleNumber, today } from "./daily";
import { wordFrequency, wordsOfLength } from "./words";

export const MAX_GUESSES = 6;

export type Mark = "correct" | "present" | "absent";
export type WordleState = {
  day: string;
  number: number;
  length: number;
  hard: boolean;
  maxGuesses: number;
  rows: { word: string; marks: Mark[] }[];
  status: "playing" | "won" | "lost";
  // only once the game is over
  answer: string | null;
};

// what the cookie holds: the guesses, never the answer or the marks (recomputed on every read)
export const WordleProgress = z.object({
  day: z.string(),
  length: z.number().int(),
  hard: z.boolean(),
  guesses: z.array(z.string().regex(/^[a-z]{4,6}$/)).max(MAX_GUESSES),
});
export type WordleProgress = z.infer<typeof WordleProgress>;

// common enough that people know it: ~3 per million words. plurals and past tenses out, "cranes"
// or "aided" arent fair answers
async function answerFor(length: number, signal: AbortSignal) {
  const words = await wordsOfLength(length, signal);
  const pool = words
    .filter((w) => w.freq >= 3 && !w.word.endsWith("s") && !w.word.endsWith("ed"))
    .map((w) => w.word);
  if (pool.length === 0) throw new Error(`no ${length} letter answers`);
  return pickDaily(pool, `wordle-${length}`);
}

/** the classic 2 passes: greens first, then yellows only for the letters left over, so a double
 * letter in the guess isnt marked yellow twice when the answer has it once */
export function score(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(guess.length).fill("absent");
  const left: Record<string, number> = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = "correct";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === "correct") continue;
    if (left[guess[i]]) {
      marks[i] = "present";
      left[guess[i]]--;
    }
  }
  return marks;
}

/** hard mode: every green stays in place, every yellow is used again */
function hardModeError(guess: string, rows: WordleState["rows"]) {
  for (const row of rows) {
    for (let i = 0; i < row.word.length; i++) {
      if (row.marks[i] === "correct" && guess[i] !== row.word[i]) {
        return `Letter ${i + 1} must be ${row.word[i].toUpperCase()}.`;
      }
      if (row.marks[i] === "present" && !guess.includes(row.word[i])) {
        return `The guess must contain ${row.word[i].toUpperCase()}.`;
      }
    }
  }
  return null;
}

export async function wordleState(
  progress: WordleProgress | null,
  length: number,
  hard: boolean,
  signal: AbortSignal,
): Promise<WordleState> {
  const answer = await answerFor(length, signal);
  // a new day or other settings = a fresh game
  const same = progress && progress.day === today() && progress.length === length;
  const guesses = same ? progress.guesses : [];
  const rows = guesses.map((word) => ({ word, marks: score(word, answer) }));
  const won = guesses.at(-1) === answer;
  const status = won ? "won" : guesses.length >= MAX_GUESSES ? "lost" : "playing";
  return {
    day: today(),
    number: puzzleNumber(),
    length,
    hard: same ? progress.hard : hard,
    maxGuesses: MAX_GUESSES,
    rows,
    status,
    answer: status === "playing" ? null : answer,
  };
}

/** checks and plays 1 guess, returns the new progress to store */
export async function playWordle(
  state: WordleState,
  raw: string,
  signal: AbortSignal,
): Promise<WordleProgress> {
  const guess = raw.trim().toLowerCase();
  if (state.status !== "playing")
    throw new WidgetError("Today's game is over, come back tomorrow.");
  if (!/^[a-z]+$/.test(guess) || guess.length !== state.length) {
    throw new WidgetError(`A guess is ${state.length} letters.`);
  }
  if (state.rows.some((r) => r.word === guess)) throw new WidgetError("Already tried.");
  if (state.hard) {
    const error = hardModeError(guess, state.rows);
    if (error) throw new WidgetError(error);
  }
  // 0.01 per million lets in real but rare words, and keeps out keyboard mashing like "xyzzy"
  if ((await wordFrequency(guess, signal)) < 0.01) throw new WidgetError("Not in the word list.");
  return {
    day: state.day,
    length: state.length,
    hard: state.hard,
    guesses: [...state.rows.map((r) => r.word), guess],
  };
}
