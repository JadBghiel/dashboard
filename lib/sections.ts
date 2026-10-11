/** the 3 sections, in order. each service is in 1 (its category), the dashboard, the services page
 * and "add widget" group by them */

export const SECTION_IDS = ["utility", "news", "games"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTIONS: { id: SectionId; title: string; description: string }[] = [
  { id: "utility", title: "Utility", description: "Weather, markets and everyday tools" },
  {
    id: "news",
    title: "News",
    description: "What's happening, live, and the headlines you follow",
  },
  {
    id: "games",
    title: "Games",
    description: "Daily puzzles, the same for everyone, new ones at midnight UTC",
  },
];
