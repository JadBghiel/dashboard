/** whether a user is subscribed to a service, decided in 1 place (#18). no table of its own: the
 * subject's "subscribe w/ your credentials" is the saved key (credential table, #17) or a linked
 * account (better-auth's account table, #19), a 2nd table would have to be kept in sync w/ them.
 *
 * - auth none: open to everyone, weather or the games
 * - api_key: the user's own key, else the app key when the server has one, else locked until the
 *   user saves a key on the services page
 * - oauth: locked until the user links that account, then the widgets run on its token */

import { keyFor, listHints } from "@/server/credential-store";
import { linkedAccounts, oauthToken } from "@/server/linked-accounts";
import type { ServiceDef, WidgetCredentials } from "@/server/registry/define";

/** ready = works w/o anything from the user, own_key = runs on the user's key, linked = runs on the
 * user's linked account, the 2 others = locked */
export const SERVICE_STATUSES = [
  "ready",
  "own_key",
  "linked",
  "missing_key",
  "needs_account",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const isUnlocked = (status: ServiceStatus) =>
  status === "ready" || status === "own_key" || status === "linked";

const hasAppKey = (service: ServiceDef) => !!service.key && !!process.env[service.key.env];

/** the status from what is already known, for lists: the services page and GET /api/services only
 * read the key hints and the linked providers, they never decrypt a key or a token to draw a badge.
 * subscribed = the user saved their own key (api_key) or linked the account (oauth) */
export function serviceStatus(service: ServiceDef, subscribed: boolean): ServiceStatus {
  if (service.auth === "none") return "ready";
  if (service.auth === "oauth") return subscribed ? "linked" : "needs_account";
  if (subscribed) return "own_key";
  return hasAppKey(service) ? "ready" : "missing_key";
}

/** what the user set up, for the services page, the settings page and GET /api/services: their keys
 * as hints, their account rows, and the status each service gets from them */
export async function setupOf(userId: string | null) {
  const [hints, accounts] = userId
    ? await Promise.all([listHints(userId), linkedAccounts(userId)])
    : [[], []];
  const keyHints = new Map(hints.map((k) => [k.serviceId, k.hint]));
  const linked = new Map(accounts.map((a) => [a.providerId, a.id]));
  return {
    keyHints,
    accounts,
    linked,
    statusOf: (service: ServiceDef) =>
      serviceStatus(service, keyHints.has(service.id) || linked.has(service.id)),
  };
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

  // the service id is the better-auth provider id
  const accessToken = userId ? await oauthToken(userId, service.id) : null;
  if (accessToken) return { kind: "oauth", accessToken };
  throw new NotSubscribedError(`Connect your ${service.name} account to use this widget.`);
}
