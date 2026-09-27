/** 2 interactive tools: translate a text, check an email address. inputs are bounded before
 * anything goes upstream, and upstream failures come back as { code, message } like everywhere */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import type { Context } from "hono";

import { WidgetError } from "@/server/registry/define";
import { checkEmail, languageCodes, translate } from "@/server/services/tools/upstreams";

import { errorResponse } from "../errors";

const json = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});

export const translateRoute = createRoute({
  method: "post",
  path: "/tools/translate",
  tags: ["tools"],
  summary: "translate a short text",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            // mymemory's free tier counts characters, 500 keeps 1 user from eating the day
            text: z.string().trim().min(1).max(500),
            from: z.enum(languageCodes),
            to: z.enum(languageCodes),
          }),
        },
      },
    },
  },
  responses: {
    200: json("the translation", z.object({ text: z.string() })),
    400: errorResponse("empty, too long, or an unsupported language"),
    422: errorResponse("the free daily quota is used up"),
    502: errorResponse("the translation service is down"),
  },
});

export const emailCheckRoute = createRoute({
  method: "post",
  path: "/tools/email-check",
  tags: ["tools"],
  summary: "check an email address",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          // 254 is the longest valid address
          schema: z.object({ email: z.string().trim().min(3).max(254) }),
        },
      },
    },
  },
  responses: {
    200: json(
      "what the address looks like",
      z.object({
        format: z.boolean(),
        domain: z.string().nullable(),
        acceptsMail: z.boolean(),
        disposable: z.boolean(),
      }),
    ),
    400: errorResponse("empty or too long"),
    502: errorResponse("the email check service is down"),
  },
});

const timeout = (c: Context) => AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(8000)]);

export const translateText: RouteHandler<typeof translateRoute> = async (c) => {
  const { text, from, to } = c.req.valid("json");
  try {
    return c.json({ text: await translate(text, from, to, timeout(c)) }, 200);
  } catch (err) {
    if (err instanceof WidgetError)
      return c.json({ code: "widget_error", message: err.message }, 422);
    console.error("translate failed", err);
    return c.json(
      { code: "upstream_error", message: "Translation is unavailable right now." },
      502,
    );
  }
};

export const emailCheck: RouteHandler<typeof emailCheckRoute> = async (c) => {
  try {
    return c.json(await checkEmail(c.req.valid("json").email, timeout(c)), 200);
  } catch (err) {
    console.error("email check failed", err);
    return c.json(
      { code: "upstream_error", message: "Email checks are unavailable right now." },
      502,
    );
  }
};
