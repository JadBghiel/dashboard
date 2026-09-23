/** weather reference service: open-meteo underneath, adapts to where the user is*/

import { defineService } from "@/server/registry/define";

import { currentWeatherWidget } from "./widgets/current-weather";

export const weather = defineService({
  id: "weather",
  name: "Weather",
  description: "Current conditions and forecasts, no account needed",
  auth: "none",
  widgets: [currentWeatherWidget],
});
