/** who is making the request, the 1 place the api asks it */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/server/db";

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

/** the signed in user of a page, a visitor goes to the log in page: the app is for registered,
 * confirmed users only (only the privacy notice and the auth pages are public) */
export async function requireUserId(): Promise<string> {
  const userId = await currentUserId(await headers());
  if (!userId) redirect("/log-in");
  return userId;
}

/** true only for a signed in user whose role is admin (the better-auth admin plugin's field) */
export async function isAdmin(headers: Headers): Promise<boolean> {
  const userId = await currentUserId(headers);
  if (!userId) return false;
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "admin";
}
