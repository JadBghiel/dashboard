/** the display settings the root layout needs on the 1st paint: text size and theme. from the db
 * for a signed in user, so they follow the account. a visitor gets the defaults, their theme stays
 * the browser's own choice */

import { TEXT_SIZES, THEMES, type TextSize, type Theme } from "@/lib/display";
import { currentUserId } from "@/server/auth/current-user";
import { db } from "@/server/db";

export type DisplaySettings = { signedIn: boolean; textSize: TextSize; theme: Theme };

const pick = <T extends string>(list: readonly T[], value: string | undefined, fallback: T) =>
  list.includes(value as T) ? (value as T) : fallback;

export async function displaySettings(headers: Headers): Promise<DisplaySettings> {
  const userId = await currentUserId(headers);
  if (!userId) return { signedIn: false, textSize: "normal", theme: "system" };
  const row = await db.userSettings.findUnique({
    where: { userId },
    select: { textSize: true, theme: true },
  });
  return {
    signedIn: true,
    textSize: pick(TEXT_SIZES, row?.textSize, "normal"),
    theme: pick(THEMES, row?.theme, "system"),
  };
}
