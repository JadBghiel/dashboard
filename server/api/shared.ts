/** what the routes share: the openapi response entries, the time limit on an upstream call, the
 * signed in user, and the answer when an upstream fails */

import { z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import { currentUserId } from "@/server/auth/current-user";
import { WidgetError } from "@/server/registry/define";
import { UPSTREAM_TIMEOUT_MS } from "@/server/services/http";

import { errorResponse, type ApiError } from "./errors";

/** openapi entry for a json answer */
export const json = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});

export const unauthorized = { 401: errorResponse("not signed in") };

/** the signed in user of a route. none = 401 through onError, so the handlers dont repeat the check */
export async function userOf(c: Context): Promise<string> {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) throw new HTTPException(401, { message: "Log in first." });
  return userId;
}

/** the request's own signal (the page went away) and a time limit, whichever comes 1st */
export const timeout = (c: Context) =>
  AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]);

/** "<what> is unavailable right now", the real error stays in the logs */
export function unavailable(c: Context, err: unknown, what: string) {
  // the page went away mid request, nobody is waiting and nothing broke
  if (!(err instanceof Error && err.name === "ResponseAborted")) {
    console.error(`${what.toLowerCase()} request failed`, err);
  }
  return c.json<ApiError, 502>(
    { code: "upstream_error", message: `${what} is unavailable right now.` },
    502,
  );
}

/** a WidgetError is the user's to read (unknown ticker, a wrong guess) -> 422, anything else -> 502 */
export function upstreamFailure(c: Context, err: unknown, what: string) {
  if (err instanceof WidgetError) {
    return c.json<ApiError, 422>({ code: "widget_error", message: err.message }, 422);
  }
  return unavailable(c, err, what);
}
