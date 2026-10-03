/** GET /api/services: every service w/ its widgets and whether it works right now. a key service
 * only says whether the server has its key, never the key itself */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";

import { registry } from "@/server/registry";

const ServiceStatus = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["utility", "news", "games"]),
  auth: z.enum(["none", "api_key", "oauth"]),
  // ready = works for everyone, missing_key = the server has no key, needs_account = link first
  status: z.enum(["ready", "missing_key", "needs_account"]),
  key: z.object({ label: z.string(), helpUrl: z.string() }).nullable(),
  widgets: z.array(z.object({ id: z.string(), name: z.string(), description: z.string() })),
});

export const servicesRoute = createRoute({
  method: "get",
  path: "/services",
  tags: ["services"],
  summary: "the service catalog and what each one needs",
  responses: {
    200: {
      description: "every service, grouped by nothing, in registry order",
      content: { "application/json": { schema: z.object({ services: z.array(ServiceStatus) }) } },
    },
  },
});

export const listServices: RouteHandler<typeof servicesRoute> = (c) => {
  const services = registry.catalog.map((s) => {
    const def = registry.getService(s.id);
    const hasKey = def?.key ? Boolean(process.env[def.key.env]) : true;
    const status =
      s.auth === "oauth"
        ? "needs_account"
        : s.auth === "api_key" && !hasKey
          ? "missing_key"
          : "ready";
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      auth: s.auth,
      status: status as "ready" | "missing_key" | "needs_account",
      key: s.key,
      widgets: s.widgets.map((w) => ({ id: w.id, name: w.name, description: w.description })),
    };
  });
  return c.json({ services }, 200);
};
