/** whether a user is subscribed to a service, decided in 1 place (#18). no table of its own: the
 * subject's "subscribe w/ your credentials" is the saved key (credential table, #17) or a linked
 * account (better-auth's account table, #19), a 2nd table would have to be kept in sync w/ them.
 *
 * - auth none: open to everyone, weather or the games
 * - api_key: the user's own key, else the app key when the server has one, else locked until the
 *   user saves a key on the services page
 * - oauth: locked until the user links that account */

import { keyFor } from "@/server/credential-store";
import type { ServiceDef, WidgetCredentials } from "@/server/registry/define";

/** ready = works w/o anything from the user, own_key = runs on the user's key, the 2 others = locked */
export type ServiceStatus = "ready" | "own_key" | "missing_key" | "needs_account";

export const isUnlocked = (status: ServiceStatus) => status === "ready" || status === "own_key";

const hasAppKey = (service: ServiceDef) => !!service.key && !!process.env[service.key.env];

/** the status from what is already known, for lists: the services page and GET /api/services only
 * read the key hints, they never decrypt every key just to draw a badge */
export function serviceStatus(service: ServiceDef, hasOwnKey: boolean): ServiceStatus {
  if (service.auth === "none") return "ready";
  if (service.auth === "oauth") return "needs_account";
  if (hasOwnKey) return "own_key";
  return hasAppKey(service) ? "ready" : "missing_key";
}

/** a locked service, its message says what to do to unlock it */
export class NotSubscribedError extends Error {}

/** the requireSubscription guard: the credentials to fetch w/ (null = none needed, or the app key
 * the fetcher reads itself), or NotSubscribedError when the user has to subscribe first */
export async function requireSubscription(
  userId: string | null,
  service: ServiceDef,
): Promise<WidgetCredentials> {
  if (service.auth === "none") return null;

  if (service.auth === "api_key") {
    const apiKey = userId ? await keyFor(userId, service.id) : null;
    if (apiKey) return { kind: "api_key", apiKey };
    if (hasAppKey(service)) return null;
    const label = service.key?.label ?? "API key";
    throw new NotSubscribedError(
      userId
        ? `Add your ${label} on the Services page to use ${service.name}.`
        : `Sign in and add your ${label} on the Services page to use ${service.name}.`,
    );
  }

  throw new NotSubscribedError(`Link your ${service.name} account on the Services page first.`);
}
