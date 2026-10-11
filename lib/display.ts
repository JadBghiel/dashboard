/** the display settings, the same list for the db column, the api, the settings page and the header
 * theme menu */

export const TEXT_SIZES = ["small", "normal", "large"] as const;
export const THEMES = ["system", "light", "dark"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export type Theme = (typeof THEMES)[number];
