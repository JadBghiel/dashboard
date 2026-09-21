/** the 1 route the api ships w/ until the real ones land, docker alsoo chekc this*/

import { createRoute, z } from "@hono/zod-openapi";

export const PingResponse = z.object({
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
