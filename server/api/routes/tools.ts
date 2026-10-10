/** the interactive translator: inputs are bounded before
 * anything goes upstream, and upstream failures come back as { code, message } like everywhere */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import type { Context } from "hono";

import { WidgetError } from "@/server/registry/define";
import { languageCodes, translate } from "@/server/services/tools/upstreams";

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
