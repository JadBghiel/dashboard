/** small everyday tools, all keyless: holidays, translation, on this day */

import { defineService } from "@/server/registry/define";

import { holidaysWidget, onThisDayWidget, translatorWidget } from "./widgets";

export const tools = defineService({
  id: "tools",
  name: "Tools",
  description: "Holidays, translation and this day in history",
  category: "utility",
  auth: "none",
  widgets: [holidaysWidget, translatorWidget, onThisDayWidget],
});
