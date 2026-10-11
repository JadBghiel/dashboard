/** the account changes both the services page and the settings page offer: remove a saved key,
 * unlink an account, link 1. each resolves to an error to show, or null once done */

import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export async function removeKey(serviceId: string): Promise<string | null> {
  const res = await api.credentials[":serviceId"]
    .$delete({ param: { serviceId } })
    .catch(() => null);
  return res?.ok ? null : "Could not remove the key, try again.";
}

/** better-auth only looks the row up among the signed in user's accounts, and refuses the last way
 * to log in */
export async function unlinkAccount(accountId: string): Promise<string | null> {
  const { error } = await authClient.unlinkAccount({ accountId });
  return error ? (error.message ?? "Could not disconnect, try again.") : null;
}

/** sends the browser to the provider and back to callbackURL once linked, or to errorCallbackURL
 * w/ ?error= when it was refused. resolves only when the provider couldnt even be reached */
export async function linkAccount(
  provider: "github" | "google",
  callbackURL: string,
  errorCallbackURL: string,
): Promise<string | null> {
  const { error } = await authClient.linkSocial({ provider, callbackURL, errorCallbackURL });
  return error ? (error.message ?? "Could not reach the provider, try again.") : null;
}
