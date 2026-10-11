/** a health check: answers w/o the db or any upstream */

import { createRoute, z } from "@hono/zod-openapi";

const PingResponse = z.object({
  message: z.literal("pong"),
  // epoch seconds, same unit as about.json current_time
  time: z.number().int(),
});

export const pingRoute = createRoute({
  method: "get",
  path: "/ping",
  tags: ["meta"],
  summary: "check the api is alive",
  responses: {
    200: {
      description: "the api is alive",
      content: { "application/json": { schema: PingResponse } },
    },
  },
});
