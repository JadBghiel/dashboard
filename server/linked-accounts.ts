/** the outside accounts a user linked through oauth2 (#19), in better-auth's account table. the
 * tokens are stored encrypted (encryptOAuthTokens), better-auth's getAccessToken decrypts them */

import { auth } from "@/lib/auth";
import { db } from "@/server/db";

/** provider id (github, google) -> its account row, for the status badges and the disconnect btn.
 * no token read */
export async function linkedAccounts(userId: string): Promise<Map<string, string>> {
  const rows = await db.account.findMany({
    where: { userId },
    select: { id: true, providerId: true },
  });
  return new Map(rows.map((r) => [r.providerId, r.id]));
}

/** the user's token for that provider, null when they never linked it, or when the server lost the
 * provider's client id and better-auth cant use the token anymore */
export async function oauthToken(userId: string, providerId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, providerId },
    select: { id: true },
  });
  if (!account) return null;
  try {
    const { accessToken } = await auth.api.getAccessToken({
      body: { accountId: account.id, userId },
    });
    return accessToken ?? null;
  } catch (err) {
    console.error(`no ${providerId} token for a linked account`, (err as Error).message);
    return null;
  }
}
