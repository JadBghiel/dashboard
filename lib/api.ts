/** typed client for the front, the types come from gono app, so a call to a route that **/

import { hc } from "hono/client";

import type { ApiType } from "@/server/api/app";

export const api = hc<ApiType>("/").api;
