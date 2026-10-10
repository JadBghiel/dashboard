import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import { Dashboard, type Spec } from "@/components/dashboard/dashboard";
import { LocationConsent } from "@/components/location-consent";
import { cardKey } from "@/components/widgets/registry";
import { TimerProvider } from "@/components/widgets/timer-provider";
import { currentUserId } from "@/server/auth/current-user";
import { DEFAULT_WIDGETS, defaultInstances, listInstances } from "@/server/instances";
import { registry } from "@/server/registry";
import { locationState } from "@/server/user-location";

// absolute, the layout template would make it "Dashboard · Dashboard"
export const metadata: Metadata = { title: { absolute: "Dashboard" } };

// what the settings window and "add widgets" need about each widget, from the same declarations as
// about.json. the default refresh rates also go to the timer for a card w/o a saved widget
const SPECS: Record<string, Spec> = Object.fromEntries(
  registry.catalog.flatMap((s) =>
    s.widgets.map((w) => [
      cardKey(s.id, w.id),
      { name: w.name, description: w.description, params: w.params, refresh: w.refresh },
    ]),
  ),
);
const RATES = Object.fromEntries(Object.entries(SPECS).map(([k, s]) => [k, s.refresh.default]));
const DEFAULT_ORDER = DEFAULT_WIDGETS.map(([s, w]) => cardKey(s, w));

export default async function DashboardPage() {
  const head = await headers();
  const jar = await cookies();
  const { location, consent } = await locationState(head, (name) => jar.get(name)?.value);
  // widgets following "your location": when it changes this key changes and they refetch
  const locationKey = `${location.lat},${location.lon},${location.country}`;
  // read here, so the user's widgets are the 1st paint, no reshuffle after load
  const userId = await currentUserId(head);
  const instances = userId ? await listInstances(userId) : defaultInstances();

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
          signedIn={!!userId}
          locationKey={locationKey}
          defaultOrder={DEFAULT_ORDER}
        />
      </TimerProvider>
    </div>
  );
}
