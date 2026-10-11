/** GET /api/services: every service w/ its widgets and whether it works for the caller right now
 * (#18). a key service only says whether there is a key, the user's or the server's, never the key */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";

import { SECTION_IDS } from "@/lib/sections";
import { currentUserId } from "@/server/auth/current-user";
import { registry } from "@/server/registry";
import { SERVICE_STATUSES, setupOf } from "@/server/subscriptions";

const ServiceStatus = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(SECTION_IDS),
  auth: z.enum(["none", "api_key", "oauth"]),
  // ready = works w/o anything from you, own_key = runs on your saved key, missing_key = locked
  // until you save a key, linked = runs on your linked account, needs_account = locked until you
  // link it
  status: z.enum(SERVICE_STATUSES),
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

export const listServices: RouteHandler<typeof servicesRoute> = async (c) => {
  // the hints only, nothing gets decrypted to draw a status
  const { statusOf } = await setupOf(await currentUserId(c.req.raw.headers));
  const services = registry.catalog.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    auth: s.auth,
    status: statusOf(registry.getService(s.id)!),
    key: s.key ? { label: s.key.label, helpUrl: s.key.helpUrl } : null,
    widgets: s.widgets.map((w) => ({ id: w.id, name: w.name, description: w.description })),
  }));
  return c.json({ services }, 200);
};
