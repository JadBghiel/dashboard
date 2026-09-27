/** small everyday tools, all keyless: holidays, translation, email checks, on this day */

import { defineService } from "@/server/registry/define";

import { emailCheckerWidget, holidaysWidget, onThisDayWidget, translatorWidget } from "./widgets";

export const tools = defineService({
  id: "tools",
  name: "Tools",
  description: "Holidays, translation, email checks and this day in history",
  category: "utility",
  auth: "none",
  widgets: [holidaysWidget, translatorWidget, emailCheckerWidget, onThisDayWidget],
});
