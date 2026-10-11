/** a fixed window per client, so 1 script hammering the api cant eat the upstream quotas everyone
 * shares. the client is the signed in user, else their ip */

import type { MiddlewareHandler } from "hono";

import { fixedWindow } from "@/lib/fixed-window";
import { currentUserId } from "@/server/auth/current-user";

import type { ApiError } from "./api/errors";

/** the caller ip. behind docker, vercel or any proxy the socket is the proxy, so the real client is
 * the 1st entry of x-forwarded-for */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

export function rateLimit(name: string, limit: number, windowSec: number): MiddlewareHandler {
  const hit = fixedWindow(limit, windowSec);

  return async (c, next) => {
    const headers = c.req.raw.headers;
    const { retryAfter } = hit((await currentUserId(headers)) ?? clientIp(headers));
    if (retryAfter > 0) {
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
