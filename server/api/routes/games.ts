/** playing the daily games. each game's progress is an httpOnly cookie holding only what the player
 * did (the guesses), the answer is recomputed and every move scored here, never sent early */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import type { Context } from "hono";

import { readJsonCookie, writeJsonCookie } from "@/server/cookies";
import { WidgetError } from "@/server/registry/define";
import { secondsToMidnight } from "@/server/services/games/daily";
import { dailyFlagImage, FlagProgress, flagState, playFlag } from "@/server/services/games/flags";
import { BeeProgress, beeState, playBee } from "@/server/services/games/spelling-bee";
import { playWordle, WordleProgress, wordleState } from "@/server/services/games/wordle";

import { errorResponse } from "../errors";

const COOKIES = {
  wordle: "dash_game_wordle",
  flags: "dash_game_flags",
  bee: "dash_game_bee",
  best2048: "dash_game_2048",
};

const Bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
const BoolOn = z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true");

const json = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});

const Status = z.enum(["playing", "won", "lost"]);

const WordleStateSchema = z.object({
  day: z.string(),
  number: z.number(),
  length: z.number(),
  hard: z.boolean(),
  maxGuesses: z.number(),
  rows: z.array(
    z.object({ word: z.string(), marks: z.array(z.enum(["correct", "present", "absent"])) }),
  ),
  status: Status,
  answer: z.string().nullable(),
});

const FlagStateSchema = z.object({
  day: z.string(),
  number: z.number(),
  maxGuesses: z.number(),
  hints: z.boolean(),
  guesses: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      correct: z.boolean(),
      distanceKm: z.number().nullable(),
      bearing: z.number().nullable(),
    }),
  ),
  status: Status,
  answer: z.object({ code: z.string(), name: z.string() }).nullable(),
  countries: z.array(z.object({ code: z.string(), name: z.string() })),
});

const BeeStateSchema = z.object({
  day: z.string(),
  number: z.number(),
  center: z.string(),
  letters: z.array(z.string()),
  minLength: z.number(),
  found: z.array(z.object({ word: z.string(), points: z.number(), pangram: z.boolean() })),
  score: z.number(),
  rank: z.string(),
});

const failures = {
  422: errorResponse("the move isnt valid, the message says why"),
  502: errorResponse("the word or country list is unavailable"),
};

// ---- routes ----

const WordleQuery = z.object({
  length: z.coerce.number().int().min(4).max(6).default(5),
  hard: Bool,
});

export const wordleGetRoute = createRoute({
  method: "get",
  path: "/games/wordle",
  tags: ["games"],
  summary: "today's wordle and your progress",
  request: { query: WordleQuery },
  responses: { 200: json("the game", WordleStateSchema), ...failures },
});

export const wordlePlayRoute = createRoute({
  method: "post",
  path: "/games/wordle",
  tags: ["games"],
  summary: "play a guess",
  request: {
    query: WordleQuery,
    body: {
      required: true,
      content: { "application/json": { schema: z.object({ guess: z.string().max(10) }) } },
    },
  },
  responses: { 200: json("the game after the guess", WordleStateSchema), ...failures },
});

const FlagQuery = z.object({
  tries: z.coerce.number().int().min(3).max(8).default(6),
  hints: BoolOn,
});

export const flagsGetRoute = createRoute({
  method: "get",
  path: "/games/flags",
  tags: ["games"],
  summary: "today's flag game and your progress",
  request: { query: FlagQuery },
  responses: { 200: json("the game", FlagStateSchema), ...failures },
});

export const flagsPlayRoute = createRoute({
  method: "post",
  path: "/games/flags",
  tags: ["games"],
  summary: "guess a country",
  request: {
    query: FlagQuery,
    body: {
      required: true,
      content: { "application/json": { schema: z.object({ guess: z.string().max(80) }) } },
    },
  },
  responses: { 200: json("the game after the guess", FlagStateSchema), ...failures },
});

const BeeQuery = z.object({ min_length: z.coerce.number().int().min(4).max(5).default(4) });

export const beeGetRoute = createRoute({
  method: "get",
  path: "/games/bee",
  tags: ["games"],
  summary: "today's spelling bee and your words",
  request: { query: BeeQuery },
  responses: { 200: json("the game", BeeStateSchema), ...failures },
});

export const beePlayRoute = createRoute({
  method: "post",
  path: "/games/bee",
  tags: ["games"],
  summary: "submit a word",
  request: {
    query: BeeQuery,
    body: {
      required: true,
      content: { "application/json": { schema: z.object({ word: z.string().max(20) }) } },
    },
  },
  responses: { 200: json("the game after the word", BeeStateSchema), ...failures },
});

// ---- handlers ----

const timeout = (c: Context) => AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(8000)]);

// a wrong guess is the player's to read, anything else (datamuse down) stays in the logs
function fail(err: unknown) {
  if (err instanceof WidgetError) {
    return { status: 422 as const, body: { code: "widget_error", message: err.message } };
  }
  // the page went away mid request, nobody is waiting and nothing broke
  if (!(err instanceof Error && err.name === "ResponseAborted"))
    console.error("game request failed", err);
  return {
    status: 502 as const,
    body: { code: "upstream_error", message: "The game is unavailable right now." },
  };
}

export const wordleGet: RouteHandler<typeof wordleGetRoute> = async (c) => {
  const { length, hard } = c.req.valid("query");
  try {
    const progress = readJsonCookie(c, COOKIES.wordle, WordleProgress);
    return c.json(await wordleState(progress, length, hard, timeout(c)), 200);
  } catch (err) {
    const f = fail(err);
    return f.status === 422 ? c.json(f.body, 422) : c.json(f.body, 502);
  }
};

export const wordlePlay: RouteHandler<typeof wordlePlayRoute> = async (c) => {
  const { length, hard } = c.req.valid("query");
  try {
    const signal = timeout(c);
    const state = await wordleState(
      readJsonCookie(c, COOKIES.wordle, WordleProgress),
      length,
      hard,
      signal,
    );
    const next = await playWordle(state, c.req.valid("json").guess, signal);
    writeJsonCookie(c, COOKIES.wordle, next);
    return c.json(await wordleState(next, length, hard, signal), 200);
  } catch (err) {
    const f = fail(err);
    return f.status === 422 ? c.json(f.body, 422) : c.json(f.body, 502);
  }
};

export const flagsGet: RouteHandler<typeof flagsGetRoute> = async (c) => {
  const { tries, hints } = c.req.valid("query");
  try {
    const progress = readJsonCookie(c, COOKIES.flags, FlagProgress);
    return c.json(await flagState(progress, tries, hints, timeout(c)), 200);
  } catch (err) {
    const f = fail(err);
    return f.status === 422 ? c.json(f.body, 422) : c.json(f.body, 502);
  }
};

export const flagsPlay: RouteHandler<typeof flagsPlayRoute> = async (c) => {
  const { tries, hints } = c.req.valid("query");
  try {
    const signal = timeout(c);
    const state = await flagState(
      readJsonCookie(c, COOKIES.flags, FlagProgress),
      tries,
      hints,
      signal,
    );
    const next = playFlag(state, c.req.valid("json").guess);
    writeJsonCookie(c, COOKIES.flags, next);
    return c.json(await flagState(next, tries, hints, signal), 200);
  } catch (err) {
    const f = fail(err);
    return f.status === 422 ? c.json(f.body, 422) : c.json(f.body, 502);
  }
};

export const beeGet: RouteHandler<typeof beeGetRoute> = async (c) => {
  const { min_length } = c.req.valid("query");
  try {
    const progress = readJsonCookie(c, COOKIES.bee, BeeProgress);
    return c.json(await beeState(progress, min_length, timeout(c)), 200);
  } catch (err) {
    const f = fail(err);
    return f.status === 422 ? c.json(f.body, 422) : c.json(f.body, 502);
  }
};

export const beePlay: RouteHandler<typeof beePlayRoute> = async (c) => {
  const { min_length } = c.req.valid("query");
  try {
    const signal = timeout(c);
    const state = await beeState(readJsonCookie(c, COOKIES.bee, BeeProgress), min_length, signal);
    const next = await playBee(state, c.req.valid("json").word, signal);
    writeJsonCookie(c, COOKIES.bee, next);
    return c.json(await beeState(next, min_length, signal), 200);
  } catch (err) {
    const f = fail(err);
    return f.status === 422 ? c.json(f.body, 422) : c.json(f.body, 502);
  }
};

/** the flag picture, plain hono (not openapi, its an image). cached by the browser until midnight,
 * private so a shared cache doesnt keep yesterday's */
export async function flagImage(c: Context) {
  try {
    const png = await dailyFlagImage(timeout(c));
    return c.body(png, 200, {
      "content-type": "image/png",
      "cache-control": `private, max-age=${secondsToMidnight()}`,
    });
  } catch (err) {
    console.error("flag image failed", err);
    return c.json({ code: "upstream_error", message: "The flag is unavailable right now." }, 502);
  }
}

// ---- 2048: a personal best per board size ----
// the game runs in the browser, so this score cant be verified, its only ever shown back to the
// same player. bounded so a hand edited request cant store something silly

const MAX_2048_SCORE = 10_000_000;
const Score = z.number().int().min(0).max(MAX_2048_SCORE);
const Best2048 = z.object({ "3": Score, "4": Score, "5": Score, "6": Score }).partial();
type Best2048 = z.infer<typeof Best2048>;
const BoardSize = z.coerce.number().int().min(3).max(6);
const BestOut = z.object({ size: z.number(), best: z.number() });

export const best2048GetRoute = createRoute({
  method: "get",
  path: "/games/2048/best",
  tags: ["games"],
  summary: "your best 2048 score for a board size",
  request: { query: z.object({ size: BoardSize.default(4) }) },
  responses: { 200: json("the best score, 0 if none yet", BestOut) },
});

export const best2048PutRoute = createRoute({
  method: "put",
  path: "/games/2048/best",
  tags: ["games"],
  summary: "report a finished score, kept only if it beats the best",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            size: BoardSize,
            score: z.number().int().min(0).max(MAX_2048_SCORE),
          }),
        },
      },
    },
  },
  responses: { 200: json("the best score after this one", BestOut) },
});

const readBest = (c: Context): Best2048 => readJsonCookie(c, COOKIES.best2048, Best2048) ?? {};

export const best2048Get: RouteHandler<typeof best2048GetRoute> = (c) => {
  const { size } = c.req.valid("query");
  const key = String(size) as keyof Best2048;
  return c.json({ size, best: readBest(c)[key] ?? 0 }, 200);
};

export const best2048Put: RouteHandler<typeof best2048PutRoute> = (c) => {
  const { size, score } = c.req.valid("json");
  const key = String(size) as keyof Best2048;
  const all = readBest(c);
  const best = Math.max(all[key] ?? 0, score);
  if (best !== all[key]) writeJsonCookie(c, COOKIES.best2048, { ...all, [key]: best });
  return c.json({ size, best }, 200);
};
