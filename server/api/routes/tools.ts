/** the interactive translator: inputs are bounded before
 * anything goes upstream, and upstream failures come back as { code, message } like everywhere */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";

import { languageCodes, translate } from "@/server/services/tools/upstreams";

import { errorResponse } from "../errors";
import { json, timeout, upstreamFailure } from "../shared";

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

export const translateText: RouteHandler<typeof translateRoute> = async (c) => {
  const { text, from, to } = c.req.valid("json");
  try {
    return c.json({ text: await translate(text, from, to, timeout(c)) }, 200);
  } catch (err) {
    return upstreamFailure(c, err, "Translation");
  }
};
