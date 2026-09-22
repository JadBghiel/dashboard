/** every service the dash supports. 1 folder per service next to this file, each exporting a
 * defineService(), and listed here */

import type { ServiceDef } from "../registry/define";
import { weather } from "./weather";

export const services: readonly ServiceDef[] = [weather];
