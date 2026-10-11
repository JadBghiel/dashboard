/** GET /api/services: every service w/ its widgets and whether it works for the caller right now
 * (#18). a key service only says whether there is a key, the user's or the server's, never the key */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";

import { currentUserId } from "@/server/auth/current-user";
import { listHints } from "@/server/credential-store";
import { linkedAccounts } from "@/server/linked-accounts";
import { registry } from "@/server/registry";
import { serviceStatus } from "@/server/subscriptions";

const ServiceStatus = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["utility", "news", "games"]),
  auth: z.enum(["none", "api_key", "oauth"]),
  // ready = works w/o anything from you, own_key = runs on your saved key, missing_key = locked
  // until you save a key, linked = runs on your linked account, needs_account = locked until you
  // link it
  status: z.enum(["ready", "own_key", "linked", "missing_key", "needs_account"]),
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
  const userId = await currentUserId(c.req.raw.headers);
  // the hints only, nothing gets decrypted to draw a status
  const ownKeys = new Set(userId ? (await listHints(userId)).map((k) => k.serviceId) : []);
  const linked = userId ? await linkedAccounts(userId) : new Map<string, string>();
  const services = registry.catalog.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    auth: s.auth,
    status: serviceStatus(registry.getService(s.id)!, ownKeys.has(s.id) || linked.has(s.id)),
    key: s.key ? { label: s.key.label, helpUrl: s.key.helpUrl } : null,
    widgets: s.widgets.map((w) => ({ id: w.id, name: w.name, description: w.description })),
  }));
  return c.json({ services }, 200);
};
