/** the signed in user's own settings, in the db so they follow the account across devices. GET reads
 * them all, PATCH only changes the display ones: the city and the consent have 1 write path each,
 * /api/location and /api/location/consent */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";

import { TEXT_SIZES, THEMES } from "@/lib/display";
import { db } from "@/server/db";
import { SavedLocation, savedLocationOf } from "@/server/location";

import { json, unauthorized, userOf } from "../shared";

const TextSize = z.enum(TEXT_SIZES);
const Theme = z.enum(THEMES);

const Settings = z.object({
  location: SavedLocation.nullable(),
  // null = not asked yet
  locationConsent: z.boolean().nullable(),
  textSize: TextSize,
  theme: Theme,
});
type Settings = z.infer<typeof Settings>;

export const getSettingsRoute = createRoute({
  method: "get",
  path: "/settings",
  tags: ["settings"],
  summary: "your settings, the defaults when you never saved any",
  responses: {
    200: json("your settings", Settings),
    ...unauthorized,
  },
});

export const updateSettingsRoute = createRoute({
  method: "patch",
  path: "/settings",
  tags: ["settings"],
  summary: "change your text size or theme. the city and the consent go through /location",
  request: {
    body: {
      content: {
        "application/json": { schema: z.object({ textSize: TextSize, theme: Theme }).partial() },
      },
    },
  },
  responses: {
    200: json("your settings as saved", Settings),
    ...unauthorized,
  },
});

type Row = {
  locationName: string | null;
  lat: number | null;
  lon: number | null;
  country: string | null;
  locationConsent: boolean | null;
  textSize: string;
  theme: string;
} | null;

function toSettings(row: Row): Settings {
  return {
    location: savedLocationOf(row),
    locationConsent: row?.locationConsent ?? null,
    textSize: TextSize.catch("normal").parse(row?.textSize),
    theme: Theme.catch("system").parse(row?.theme),
  };
}

export const getSettings: RouteHandler<typeof getSettingsRoute> = async (c) => {
  const userId = await userOf(c);
  return c.json(toSettings(await db.userSettings.findUnique({ where: { userId } })), 200);
};

export const updateSettings: RouteHandler<typeof updateSettingsRoute> = async (c) => {
  const userId = await userOf(c);
  const patch = c.req.valid("json");
  const row = await db.userSettings.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
  return c.json(toSettings(row), 200);
};
