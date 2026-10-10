/** the news options a headlines widget can pick from: the google news topics and the languages
 * its feeds come in. the server checks the params against them, the settings window offers them */

export const NEWS_TOPICS = [
  "world",
  "local",
  "business",
  "technology",
  "science",
  "health",
  "sports",
  "entertainment",
] as const;
export type NewsTopic = (typeof NEWS_TOPICS)[number];

export const NEWS_LANGUAGES = ["en", "fr", "es", "de", "it", "pt", "nl", "ja", "ko"] as const;
export type NewsLanguage = (typeof NEWS_LANGUAGES)[number];
