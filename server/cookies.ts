/** the app's own cookies (game progress). httpOnly so page js never touches them, lax so they ride
 * along on normal navigation, and secure only over https bc docker serves plain http on localhost
 * and a secure cookie would never come back there */

import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { z } from "zod";

const PREF_MAX_AGE = 60 * 60 * 24 * 365;

export const prefCookie = (url: string) =>
  ({
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: PREF_MAX_AGE,
    secure: new URL(url).protocol === "https:",
  }) as const;

/** a cookie value is user controlled: anything that doesnt parse against the schema is null, never
 * thrown. raw strings come in url encoded or not depending on who reads them */
function parseJsonCookie<S extends z.ZodType>(
  raw: string | undefined,
  schema: S,
): z.infer<S> | null {
  if (!raw) return null;
  try {
    const text = /^%[57]B/i.test(raw) ? decodeURIComponent(raw) : raw;
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const readJsonCookie = <S extends z.ZodType>(c: Context, name: string, schema: S) =>
  parseJsonCookie(getCookie(c, name), schema);

export const writeJsonCookie = (c: Context, name: string, value: unknown) =>
  setCookie(c, name, JSON.stringify(value), prefCookie(c.req.url));
