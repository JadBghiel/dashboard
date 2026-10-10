/** where the user is, for every page and widget fetch. a signed in user's city and consent live in
 * their settings in the db, so they follow them to any device. a visitor w/o an account only has
 * cookies, nothing else to tie them to */

import { currentUserId } from "@/server/auth/current-user";
import { db } from "@/server/db";
import {
  CONSENT_COOKIE,
  LOCATION_COOKIE,
  parseConsent,
  parseSavedLocation,
  resolveSaved,
  type SavedLocation,
} from "@/server/location";
import type { UserLocation } from "@/server/registry/define";

type HeaderReader = Pick<Headers, "get" | "has">;
// next's cookies() and hono's getCookie both fit
type CookieReader = (name: string) => string | undefined;

export type LocationState = {
  location: UserLocation;
  // null = not asked yet, the dashboard asks
  consent: boolean | null;
};

export async function locationState(
  headers: HeaderReader,
  cookie: CookieReader,
): Promise<LocationState> {
  const userId = await currentUserId(headers as Headers);
  if (!userId) {
    const consent = parseConsent(cookie(CONSENT_COOKIE));
    return {
      location: resolveSaved(
        parseSavedLocation(cookie(LOCATION_COOKIE)),
        headers,
        consent === true,
      ),
      consent,
    };
  }
  const row = await db.userSettings.findUnique({
    where: { userId },
    select: { locationName: true, lat: true, lon: true, country: true, locationConsent: true },
  });
  const saved: SavedLocation | null =
    row?.locationName && row.lat != null && row.lon != null
      ? { name: row.locationName, lat: row.lat, lon: row.lon, country: row.country ?? undefined }
      : null;
  const consent = row?.locationConsent ?? null;
  return { location: resolveSaved(saved, headers, consent === true), consent };
}

export const userLocation = async (headers: HeaderReader, cookie: CookieReader) =>
  (await locationState(headers, cookie)).location;

/** saves the city in the user's settings, null forgets it */
export async function saveLocationOf(userId: string, place: SavedLocation | null) {
  const loc = {
    locationName: place?.name ?? null,
    lat: place?.lat ?? null,
    lon: place?.lon ?? null,
    country: place?.country ?? null,
  };
  await db.userSettings.upsert({ where: { userId }, create: { userId, ...loc }, update: loc });
}

export async function saveConsentOf(userId: string, allow: boolean) {
  await db.userSettings.upsert({
    where: { userId },
    create: { userId, locationConsent: allow },
    update: { locationConsent: allow },
  });
}
