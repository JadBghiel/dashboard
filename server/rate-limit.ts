/** a fixed window per client, so 1 script hammering the api cant eat the upstream quotas everyone
 * shares. the client is the signed in user, else their ip. kept in memory, so each server copy
 * counts on its own: a guard against abuse, not an exact quota */

import type { MiddlewareHandler } from "hono";

import { currentUserId } from "@/server/auth/current-user";

import type { ApiError } from "./api/errors";

const MAX_CLIENTS = 10_000;

export function rateLimit(name: string, limit: number, windowSec: number): MiddlewareHandler {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const headers = c.req.raw.headers;
    const client =
      (await currentUserId(headers)) ??
      headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      headers.get("x-real-ip") ??
      "unknown";
    const now = Date.now();
    let w = windows.get(client);
    if (!w || w.resetAt <= now) {
      if (windows.size >= MAX_CLIENTS) windows.clear();
      w = { count: 0, resetAt: now + windowSec * 1000 };
      windows.set(client, w);
    }
    w.count++;
    if (w.count > limit) {
      const retryAfter = Math.ceil((w.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json<ApiError>(
        {
          code: "rate_limited",
          message: `Too many ${name} requests, try again in ${retryAfter}s.`,
        },
        429,
      );
    }
    await next();
  };
}
