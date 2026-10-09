import type { Context } from "hono";
import { prisma } from "@/lib/db";
import type { ServiceDef } from "@/server/registry/define";
import { getSessionUser } from "./session-middleware";

export type SubscriptionCheck =
  | { ok: true }
  | { ok: false; status: 401; body: { code: "unauthorized"; message: string } }
  | { ok: false; status: 403; body: { code: "forbidden"; message: string } };

export async function requireSubscription(
  c: Context,
  service: ServiceDef,
): Promise<SubscriptionCheck> {
  const user = getSessionUser(c);
  if (!user) {
    return { ok: false, status: 401, body: { code: "unauthorized", message: "Log in first." } };
  }
  // keyless services (weather) are open to any logged in user, no subscription row needed
  if (service.auth === "none") return { ok: true };

  const sub = await prisma.serviceSubscription.findUnique({
    where: { userId_serviceId: { userId: user.id, serviceId: service.id } },
  });

  if (!sub || sub.status !== "active") {
    return {
      ok: false,
      status: 403,
      body: { code: "forbidden", message: `Subscribe to ${service.name} first.` },
    };
  }
  return { ok: true };
}
