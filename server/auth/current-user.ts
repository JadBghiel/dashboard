/** who is making the request, the 1 place the api asks it. until better-auth is on main (nico's
 * feat/accounts) theres no session to read, so in dev only it answers w/ the user named in
 * DEV_USER_EMAIL, which lets the per user features be built and clicked through locally.
 * after the merge the body of lookup() becomes:
 *   return (await auth.api.getSession({ headers }))?.user.id ?? null
 * and the dev fallback goes away */

import { db } from "@/server/db";

let devUserId: string | null | undefined;

// 1 widget fetch asks up to 3 times (the rate limit, the location, the user's key). once the
// session read is a db query, that's 1 query per request instead of 3
const perRequest = new WeakMap<Headers, Promise<string | null>>();

export function currentUserId(headers: Headers): Promise<string | null> {
  let found = perRequest.get(headers);
  if (!found) {
    found = lookup(headers);
    perRequest.set(headers, found);
  }
  return found;
}

// headers is unused until the merge, the session read needs it then
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function lookup(headers: Headers): Promise<string | null> {
  const devEmail = process.env.DEV_USER_EMAIL;
  // never in production, a build there always gets null -> 401
  if (process.env.NODE_ENV !== "development" || !devEmail) return null;
  if (devUserId === undefined) {
    const user = await db.user.findUnique({ where: { email: devEmail }, select: { id: true } });
    devUserId = user?.id ?? null;
  }
  return devUserId;
}
