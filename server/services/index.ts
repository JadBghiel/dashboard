/** every service the dash supports. 1 folder per service next to this file, each exporting a
 * defineService(), and listed here */

import type { ServiceDef } from "../registry/define";
import { games } from "./games";
import { github } from "./github";
import { currencies, market } from "./market";
import { news } from "./news";
import { tools } from "./tools";
import { weather } from "./weather";

export const services: readonly ServiceDef[] = [
  weather,
  market,
  currencies,
  github,
  tools,
  news,
  games,
];
