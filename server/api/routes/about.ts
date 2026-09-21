/** GET /about.json, the endpoint the grading script checks. built from the registry catalog on every
 * call, never written by hand, so it cant go stale the day someone adds a param */

import { createRoute, z } from "@hono/zod-openapi";

import type { CatalogService } from "@/server/registry";

const AboutParam = z.object({ name: z.string(), type: z.enum(["string", "integer"]) });

const AboutWidget = z.object({
  name: z.string(),
  description: z.string(),
  params: z.array(AboutParam),
});

export const AboutResponse = z.object({
  client: z.object({ host: z.string() }),
  server: z.object({
    current_time: z.number().int(),
    services: z.array(z.object({ name: z.string(), widgets: z.array(AboutWidget) })),
  }),
});

export const aboutRoute = createRoute({
  method: "get",
  path: "/about.json",
  tags: ["meta"],
  summary: "services and widgets this server supports",
  description: "also served at /about.json on the root, thats the url the subject grades",
  responses: {
    200: {
      description: "the server catalog, in the shape the subject asks for",
      content: { "application/json": { schema: AboutResponse } },
    },
  },
});

/** only the fields the subject lists. the catalog knows more (kind, options, defaults) but thats for
 * our front, not for the grading script */
export function buildAbout(
  host: string,
  catalog: CatalogService[],
  now = Date.now(),
): z.infer<typeof AboutResponse> {
  return {
    client: { host },
    server: {
      current_time: Math.floor(now / 1000),
      services: catalog.map((s) => ({
        name: s.id,
        widgets: s.widgets.map((w) => ({
          name: w.id,
          description: w.description,
          params: w.params.map((p) => ({ name: p.name, type: p.type })),
        })),
      })),
    },
  };
}

/** the caller ip. behind docker, vercel or any proxy the socket is the proxy, so the real client
 * is the 1st entry of x-forwarded-for. its only displayed, never trusted for anything */
export function clientHost(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}
