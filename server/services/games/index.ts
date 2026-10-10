/** daily games: the same puzzle for everyone each day. the widgets' fetch returns what the puzzle
 * looks like, never the answer. playing goes through /api/games/*, which keeps each player's
 * progress in an httpOnly cookie and scores every move on the server */

import { z } from "zod";

import { defineService, defineWidget } from "@/server/registry/define";

import { puzzleNumber } from "./daily";
import { flagState } from "./flags";
import { beeState } from "./spelling-bee";
import { MAX_GUESSES } from "./wordle";

export const wordleWidget = defineWidget({
  id: "wordle",
  name: "Wordle",
  description: "Guess the daily word in 6 tries",
  params: z.object({
    length: z.number().int().min(4).max(6).default(5),
    // greens stay in place, yellows must be reused
    hard_mode: z.boolean().default(false),
  }),
  refresh: { default: 3600, min: 600 },
  cache: { ttl: 3600 },
  payload: z.object({ number: z.number(), length: z.number(), maxGuesses: z.number() }),
  async fetch({ params }) {
    return { number: puzzleNumber(), length: params.length, maxGuesses: MAX_GUESSES };
  },
});

export const flagGuesserWidget = defineWidget({
  id: "flag_guesser",
  name: "Flag guesser",
  description: "Guess the daily country from its flag",
  params: z.object({
    tries: z.number().int().min(3).max(8).default(6),
    // distance and direction to the answer after each miss
    hints: z.boolean().default(true),
  }),
  refresh: { default: 3600, min: 600 },
  cache: { ttl: 3600 },
  payload: z.object({ number: z.number(), maxGuesses: z.number(), countries: z.number() }),
  async fetch({ params, signal }) {
    const state = await flagState(null, params.tries, params.hints, signal);
    return { number: state.number, maxGuesses: params.tries, countries: state.countries.length };
  },
});

export const spellingBeeWidget = defineWidget({
  id: "spelling_bee",
  name: "Spelling Bee",
  description: "Make words from the daily 7 letters, always w/ the center one",
  params: z.object({
    min_length: z.number().int().min(4).max(5).default(4),
  }),
  refresh: { default: 3600, min: 600 },
  cache: { ttl: 3600 },
  payload: z.object({
    number: z.number(),
    center: z.string(),
    letters: z.array(z.string()),
    minLength: z.number(),
  }),
  async fetch({ params, signal }) {
    const s = await beeState(null, params.min_length, signal);
    return { number: s.number, center: s.center, letters: s.letters, minLength: s.minLength };
  },
});

// runs entirely in the browser, there's nothing daily or secret about a 2048 board. the fetch only
// hands the card its config, the personal best lives in a cookie through /api/games/2048/best
export const game2048Widget = defineWidget({
  id: "game_2048",
  name: "2048",
  description: "Slide the tiles, merge equal numbers, reach the target",
  params: z.object({
    size: z.number().int().min(3).max(6).default(4),
    target: z.enum(["1024", "2048", "4096"]).default("2048"),
  }),
  refresh: { default: 3600, min: 600 },
  cache: { ttl: 3600 },
  payload: z.object({ size: z.number(), target: z.number() }),
  async fetch({ params }) {
    return { size: params.size, target: Number(params.target) };
  },
});

export const games = defineService({
  id: "games",
  name: "Games",
  description: "Daily puzzles, the same for everyone",
  category: "games",
  auth: "none",
  widgets: [wordleWidget, flagGuesserWidget, spellingBeeWidget, game2048Widget],
});
