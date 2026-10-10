/** who is making the request, the 1 place the api asks it */

import { auth } from "@/lib/auth";

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

async function lookup(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
