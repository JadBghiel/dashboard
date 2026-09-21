/** GET /about.json on the root, the url the subject grades. forwards to the same hono route as
 * /api/about.json, so theres still 1 implementation. a next rewrite doesnt work here: it keeps the
 * original url on the request, and hono only answers under /api */

import { api } from "@/server/api/app";

export function GET(req: Request) {
  const url = new URL(req.url);
  url.pathname = "/api/about.json";
  // new Request(url, req) keeps the headers, x-forwarded-for included, so client.host still works
  return api.fetch(new Request(url, req));
}
