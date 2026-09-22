import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import { CurrentWeatherCard } from "@/components/widgets/weather/current-weather-card";
import { LOCATION_COOKIE, resolveLocation } from "@/server/location";

// absolute, the layout template would make it "Dashboard · Dashboard"
export const metadata: Metadata = { title: { absolute: "Dashboard" } };

export default async function DashboardPage() {
  const location = resolveLocation((await cookies()).get(LOCATION_COOKIE)?.value, await headers());
  // widget follow "your location": when the location changes this key changes and they refetch
  const locationKey = `${location.lat},${location.lon}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Weather for {location.name}. Your own widgets, saved and arranged, arrive with accounts.
        </p>
      </div>
      {/* as many 260px columns as fit: 1 on a phone, 4 or 5 on a wide screen, like the target
          layout. the real grid w/ drag and drop and sizes is #23 similar to whats on the pdf */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        <CurrentWeatherCard locationKey={locationKey} />
      </div>
    </div>
  );
}
