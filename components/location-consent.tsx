"use client";

/** asked once, before the city is ever guessed from the connection (gdpr). until the user answers,
 * the dashboard uses madrid or the city they picked. the answer can be changed in settings */

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function LocationConsent() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(allow: boolean) {
    setBusy(true);
    setError(null);
    const res = await api.location.consent.$put({ json: { allow } }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Could not save your answer, try again.");
    // the page re-reads the location, the widgets follow
    router.refresh();
  }

  return (
    <section
      aria-labelledby="location-consent"
      className="bg-muted/50 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
    >
      <MapPin className="text-muted-foreground size-5 shrink-0" aria-hidden />
      <div className="flex-1 space-y-1 text-sm">
        <h2 id="location-consent" className="font-medium">
          Show the weather and news for where you are?
        </h2>
        <p className="text-muted-foreground">
          We can guess your city from your connection. It&apos;s only used for your widgets and you
          can change your answer in Settings.{" "}
          <Link href="/settings#privacy" className="text-foreground underline underline-offset-4">
            Privacy
          </Link>
        </p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => answer(false)}>
          No thanks
        </Button>
        <Button size="sm" disabled={busy} onClick={() => answer(true)}>
          Yes, use my location
        </Button>
      </div>
    </section>
  );
}
