import type { Metadata } from "next";
import { headers } from "next/headers";

import { Dashboard } from "@/components/dashboard/dashboard";
import { LocationConsent } from "@/components/location-consent";
import { TimerProvider } from "@/components/widgets/timer-provider";
import { requireUserId } from "@/server/auth/current-user";
import { listInstances } from "@/server/instances";
import { locationState } from "@/server/user-location";

import { DEFAULT_ORDER, RATES, SPECS } from "./specs";

// absolute, the layout template would make it "Dashboard · Dashboard"
export const metadata: Metadata = { title: { absolute: "Dashboard" } };

export default async function DashboardPage() {
  const userId = await requireUserId();
  const head = await headers();
  const { location, consent } = await locationState(head);
  // widgets following "your location": when it changes this key changes and they refetch
  const locationKey = `${location.lat},${location.lon},${location.country}`;
  // read here, so the user's widgets are the 1st paint, no reshuffle after load
  const instances = await listInstances(userId);

  return (
    <div className="space-y-8">
      <TimerProvider rates={RATES}>
        <Dashboard
          heading={
            <div className="space-y-1">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground text-sm">Everything around {location.name}.</p>
            </div>
          }
          // asked once, unless the user already picked a city
          notice={consent === null && location.source !== "saved" ? <LocationConsent /> : null}
          initial={instances.map((i) => ({ ...i, params: i.params as Record<string, unknown> }))}
          specs={SPECS}
          locationKey={locationKey}
          defaultOrder={DEFAULT_ORDER}
        />
      </TimerProvider>
    </div>
  );
}
