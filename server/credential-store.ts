/** a user's own api keys, encrypted in the credential table. the api lists hints only, the plain
 * key only ever leaves here to go to the upstream, inside a widget fetch */

import { db } from "@/server/db";

import { hintOf, open, seal } from "./credentials";

const context = (userId: string, serviceId: string) => `${userId}:${serviceId}`;

export async function saveKey(userId: string, serviceId: string, apiKey: string) {
  const sealed = seal(apiKey, context(userId, serviceId));
  const data = { ...sealed, hint: hintOf(apiKey) };
  await db.credential.upsert({
    where: { userId_serviceId: { userId, serviceId } },
    create: { userId, serviceId, ...data },
    update: data,
  });
  return { serviceId, hint: data.hint };
}

export async function deleteKey(userId: string, serviceId: string) {
  await db.credential.deleteMany({ where: { userId, serviceId } });
}

export const listHints = (userId: string) =>
  db.credential.findMany({
    where: { userId },
    select: { serviceId: true, hint: true },
    orderBy: { serviceId: "asc" },
  });

/** the plain key for a widget fetch, null when the user has none. a row that doesnt open (the
 * master key changed, the bytes were touched) counts as none, the app key takes over */
export async function keyFor(userId: string, serviceId: string): Promise<string | null> {
  const row = await db.credential.findUnique({
    where: { userId_serviceId: { userId, serviceId } },
  });
  if (!row) return null;
  try {
    return open(row, context(userId, serviceId));
  } catch {
    console.error(`credential for ${serviceId} doesnt decrypt, ignored`);
    return null;
  }
}
