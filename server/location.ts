/** where the user is, decided in 1 place: the city they picked (cookie), else what vercel guessed
 * from their ip, else madrid. a cookie and not localStorage bc the server reads it on every request,
 * so every widget fetch already knows the location w/o the browser having to send it */

import { z } from "zod";

import type { UserLocation } from "./registry/define";

export const LOCATION_COOKIE = "dash_location";

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

export function resolveLocation(savedRaw: string | undefined, headers: HeaderReader): UserLocation {
  const saved = parseSavedLocation(savedRaw);
  // a device position has no country (no reverse geocoding), the connection's is the best guess
  if (saved) {
    return {
      ...saved,
      country: saved.country ?? ipCountry(headers) ?? DEFAULT_COUNTRY,
      source: "saved",
    };
  }
  return ipLocation(headers) ?? DEFAULT_LOCATION;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
