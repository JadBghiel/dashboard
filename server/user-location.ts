/** where the user is, for every page and widget fetch. the city and the consent live in the user's
 * settings in the db, so they follow them to any device. signed out (only the public /privacy page)
 * it's the default city */

import { currentUserId } from "@/server/auth/current-user";
import { db } from "@/server/db";
import {
  DEFAULT_LOCATION,
  resolveSaved,
  savedLocationOf,
  type HeaderReader,
  type SavedLocation,
} from "@/server/location";
import type { UserLocation } from "@/server/registry/define";

export type LocationState = {
  location: UserLocation;
  // null = not asked yet, the dashboard asks
  consent: boolean | null;
};

export async function locationState(headers: HeaderReader): Promise<LocationState> {
  const userId = await currentUserId(headers as Headers);
  if (!userId) return { location: DEFAULT_LOCATION, consent: null };
  const row = await db.userSettings.findUnique({
    where: { userId },
    select: { locationName: true, lat: true, lon: true, country: true, locationConsent: true },
  });
  const consent = row?.locationConsent ?? null;
  return { location: resolveSaved(savedLocationOf(row), headers, consent === true), consent };
}

export const userLocation = async (headers: HeaderReader) =>
  (await locationState(headers)).location;

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
