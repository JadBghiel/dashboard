/** every /api/* request goes to hono app, 1 catch all instead of a next route per endpoint */

import { handle } from "hono/vercel";

import { api } from "@/server/api/app";

const handler = handle(api);

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
