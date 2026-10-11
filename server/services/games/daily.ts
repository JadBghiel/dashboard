/** what makes a game "daily": the same puzzle for everyone, picked from the utc date. no database,
 * a hash of the date and the game name picks the index */

import { today } from "@/lib/day";

// the puzzle number shown to players, day 1 being the 1st of january 2026
export const puzzleNumber = (day = today()) =>
  Math.floor((Date.parse(day) - Date.parse("2026-01-01")) / 86_400_000) + 1;

/** fnv-1a, stable across restarts and servers so every instance agrees on the day's pick */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const pickDaily = <T>(list: readonly T[], seed: string): T =>
  list[hash(`${seed}|${today()}`) % list.length];

/** seconds until the next utc midnight, when every daily puzzle changes */
export const secondsToMidnight = () => {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.ceil((next - now.getTime()) / 1000);
};
