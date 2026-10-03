/** the order of the widgets inside each dashboard section. saved in an httpOnly cookie until accounts
 * exist. a widget never leaves its section, only its place inside it changes */

import { z } from "zod";

export const LAYOUT_COOKIE = "dash_layout";

// the default order, and the full list of what each section can hold
export const DEFAULT_LAYOUT = {
  utility: [
    "weather",
    "stocks",
    "crypto",
    "currency",
    "holidays",
    "translator",
    "email",
    "on_this_day",
  ],
  news: ["world_map", "live_tv", "news"],
  games: ["wordle", "flags", "bee", "2048"],
} as const satisfies Record<string, readonly string[]>;

export type SectionId = keyof typeof DEFAULT_LAYOUT;
export type Layout = Record<SectionId, string[]>;

const Ids = z.array(z.string().max(40)).max(40);
export const SavedLayout = z.object({ utility: Ids, news: Ids, games: Ids }).partial();

/** a saved layout is only a preference: unknown ids and duplicates are dropped, and a widget added
 * since the cookie was written shows up at the end, so nobody loses a new widget */
export function normalizeLayout(saved: z.infer<typeof SavedLayout> | null): Layout {
  const out = {} as Layout;
  for (const section of Object.keys(DEFAULT_LAYOUT) as SectionId[]) {
    const known: readonly string[] = DEFAULT_LAYOUT[section];
    const kept = [...new Set(saved?.[section] ?? [])].filter((id) => known.includes(id));
    out[section] = [...kept, ...known.filter((id) => !kept.includes(id))];
  }
  return out;
}
