/** the signed in user's own settings, in the db so they follow the account across devices. GET reads
 * them all, PATCH only changes the display ones: the city and the consent have 1 write path each,
 * /api/location and /api/location/consent */

import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";

import { currentUserId } from "@/server/auth/current-user";
import { db } from "@/server/db";

import { errorResponse, type ApiError } from "../errors";

const Location = z.object({
  name: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
});
const TextSize = z.enum(["small", "normal", "large"]);
const Theme = z.enum(["system", "light", "dark"]);

const Settings = z.object({
  location: Location.nullable(),
  // null = not asked yet
  locationConsent: z.boolean().nullable(),
  textSize: TextSize,
  theme: Theme,
});
type Settings = z.infer<typeof Settings>;

const json = { "application/json": { schema: Settings } };

export const getSettingsRoute = createRoute({
  method: "get",
  path: "/settings",
  tags: ["settings"],
  summary: "your settings, the defaults when you never saved any",
  responses: {
    200: { description: "your settings", content: json },
    401: errorResponse("not signed in"),
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
    200: { description: "your settings as saved", content: json },
    401: errorResponse("not signed in"),
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
  const hasLocation = row?.locationName && row.lat != null && row.lon != null;
  return {
    location: hasLocation
      ? { name: row.locationName!, lat: row.lat!, lon: row.lon!, country: row.country }
      : null,
    locationConsent: row?.locationConsent ?? null,
    textSize: TextSize.catch("normal").parse(row?.textSize),
    theme: Theme.catch("system").parse(row?.theme),
  };
}

const noUser: ApiError = { code: "unauthorized", message: "Sign in to see your settings." };

export const getSettings: RouteHandler<typeof getSettingsRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) return c.json(noUser, 401);
  return c.json(toSettings(await db.userSettings.findUnique({ where: { userId } })), 200);
};

export const updateSettings: RouteHandler<typeof updateSettingsRoute> = async (c) => {
  const userId = await currentUserId(c.req.raw.headers);
  if (!userId) return c.json(noUser, 401);
  const patch = c.req.valid("json");
  const row = await db.userSettings.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
  return c.json(toSettings(row), 200);
};
