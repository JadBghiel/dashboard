"use client";

/** where the weather is for, the choice is saved in an httpOnly cookie through /api/location, 
 * safer this way, its also reshred after any change so location refetches */

import { LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import type { UserLocation } from "@/server/registry/define";

type Place = { name: string; country?: string; admin1?: string; lat: number; lon: number };

const SOURCE_LABEL: Record<UserLocation["source"], string> = {
  saved: "Saved by you",
  ip: "Guessed from your connection",
  default: "Default city",
};

export function LocationPicker({ location }: { location: UserLocation }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // debounced so typing "madrid" is 1 search, not 6
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.location.search.$get(
          { query: { q } },
          { init: { signal: ctrl.signal } },
        );
        const body = await res.json();
        setPlaces("places" in body ? body.places : []);
        setMessage("places" in body ? null : body.message);
      } catch {
        // aborted by the next keystroke, nothing to show
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  async function save(place: { name: string; lat: number; lon: number }) {
    setBusy(true);
    const res = await api.location.$put({ json: place });
    setBusy(false);
    if (!res.ok) return setMessage("Could not save this location.");
    close();
  }

  async function reset() {
    setBusy(true);
    await api.location.$delete();
    setBusy(false);
    close();
  }

  function close() {
    setOpen(false);
    setQuery("");
    setPlaces([]);
    setMessage(null);
    router.refresh();
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      return setMessage("Your browser can't share its location.");
    }
    setBusy(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      // open-meteo has no reverse geocoding, so a precise position gets a generic name
      (pos) => save({ name: "Your location", lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        setBusy(false);
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? "Location access was denied, search for a city instead"
            : "your location couldnt be found, search for a city instead",
        );
      },
      { timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="max-w-48 gap-1.5"
          aria-label={`Change location, now ${location.name}`}
        >
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{location.name}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-medium">{location.name}</p>
          <p className="text-muted-foreground text-xs">{SOURCE_LABEL[location.source]}</p>
        </div>

        <Button variant="outline" className="w-full" onClick={locateMe} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <LocateFixed />}
          Use my current location
        </Button>

        <div className="relative">
          <Search
            className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) setPlaces([]);
            }}
            placeholder="Search a city"
            aria-label="Search a city"
            className="pl-8"
          />
        </div>

        {places.length > 0 && (
          <ul className="space-y-1" aria-label="Matching cities">
            {places.map((p) => (
              <li key={`${p.lat},${p.lon}`}>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start py-1.5 text-left"
                  onClick={() => save({ name: p.name, lat: p.lat, lon: p.lon })}
                  disabled={busy}
                >
                  <span>
                    <span className="block text-sm">{p.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {[p.admin1, p.country].filter(Boolean).join(", ")}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}

        {message && (
          <p role="alert" className="text-destructive text-sm">
            {message}
          </p>
        )}

        {location.source === "saved" && (
          <Button variant="ghost" size="sm" className="w-full" onClick={reset} disabled={busy}>
            Forget my choice
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
