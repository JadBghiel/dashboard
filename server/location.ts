/** where the user is, decided in 1 place: the city they picked, else what vercel guessed from their
 * ip if they said yes to it (gdpr), else madrid. server/user-location.ts reads the saved city and the
 * consent, from the db for a signed in user or from cookies for a visitor */

import { z } from "zod";

import type { UserLocation } from "./registry/define";

export const LOCATION_COOKIE = "dash_location";
// a visitor's answer to "guess my city from my connection?": "yes" or "no", absent = not asked
export const CONSENT_COOKIE = "dash_location_consent";

export const CountryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "not a country code");

// madrid's, and the fallback when nothing else tells us where the user is
const DEFAULT_COUNTRY = "ES";

export const SavedLocation = z.object({
  name: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  country: CountryCode.optional(),
});
export type SavedLocation = z.infer<typeof SavedLocation>;

export const DEFAULT_LOCATION: UserLocation = {
  name: "Madrid",
  lat: 40.4165,
  lon: -3.7026,
  country: DEFAULT_COUNTRY,
  source: "default",
};

/** the cookie is user controlled, so anything that doesnt parse is ignored, never thrown */
export function parseSavedLocation(raw: string | undefined): SavedLocation | null {
  if (!raw) return null;
  // setCookie url encodes the value, some readers hand it back still encoded
  const text = raw.startsWith("%7B") ? safeDecode(raw) : raw;
  try {
    const parsed = SavedLocation.safeParse(JSON.parse(text ?? ""));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** vercel adds these to every request from its edge. theyre absent in docker and in dev, and
 * spoofing them only changes your own weather, so theyre safe to use as a guess */
// only get and has, so next's read only headers() fits as well as a fetch Request's headers
type HeaderReader = Pick<Headers, "get" | "has">;

function ipLocation(headers: HeaderReader): UserLocation | null {
  if (!headers.has("x-vercel-ip-latitude") || !headers.has("x-vercel-ip-longitude")) return null;
  const lat = Number(headers.get("x-vercel-ip-latitude"));
  const lon = Number(headers.get("x-vercel-ip-longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  const city = headers.get("x-vercel-ip-city");
  return {
    name: (city && safeDecode(city)) || "Your area",
    lat,
    lon,
    country: ipCountry(headers) ?? DEFAULT_COUNTRY,
    source: "ip",
  };
}

const ipCountry = (headers: HeaderReader) => {
  const parsed = CountryCode.safeParse(headers.get("x-vercel-ip-country") ?? "");
  return parsed.success ? parsed.data : null;
};

/** the saved city wins. the connection is only used w/ the user's consent: for the city when nothing
 * is saved, and for the country of a device position, which comes w/o one (no reverse geocoding) */
export function resolveSaved(
  saved: SavedLocation | null,
  headers: HeaderReader,
  consent: boolean,
): UserLocation {
  if (saved) {
    return {
      ...saved,
      country: saved.country ?? (consent ? ipCountry(headers) : null) ?? DEFAULT_COUNTRY,
      source: "saved",
    };
  }
  return (consent && ipLocation(headers)) || DEFAULT_LOCATION;
}

export const parseConsent = (raw: string | undefined) =>
  raw === "yes" ? true : raw === "no" ? false : null;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
