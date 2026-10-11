"use client";

/** the settings page body: where the weather is for, the text size and the theme. each choice is
 * applied at once and saved to the account, so it's the same on every device */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";

import { LocationPicker } from "@/components/location-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { UserLocation } from "@/server/registry/define";
import type { TextSize, Theme } from "@/server/user-settings";

const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
];

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function SettingsForm({
  location,
  consent: savedConsent,
  textSize: savedSize,
  theme: savedTheme,
}: {
  location: UserLocation;
  // may the city be guessed from the connection (gdpr)
  consent: boolean;
  textSize: TextSize;
  theme: Theme;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [consent, setConsent] = useState(savedConsent);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [consentError, setConsentError] = useState<string | null>(null);

  async function pickConsent(allow: boolean) {
    setConsent(allow);
    setConsentError(null);
    const res = await api.location.consent.$put({ json: { allow } }).catch(() => null);
    if (!res?.ok) {
      setConsent(!allow);
      return setConsentError("Could not save, try again.");
    }
    // the location shown above may change, the page re-reads it
    router.refresh();
  }
  const [textSize, setTextSize] = useState(savedSize);
  const [theme, setThemeState] = useState(savedTheme);
  const [status, setStatus] = useState<string | null>(null);

  async function save(patch: { textSize?: TextSize; theme?: Theme }, undo: () => void) {
    setStatus(null);
    const res = await api.settings.$patch({ json: patch }).catch(() => null);
    if (res?.ok) return setStatus("Saved.");
    undo();
    setStatus("Could not save, try again.");
  }

  function pickSize(next: TextSize) {
    const before = textSize;
    const apply = (s: TextSize) => {
      setTextSize(s);
      document.documentElement.dataset.textSize = s;
    };
    apply(next);
    save({ textSize: next }, () => apply(before));
  }

  function pickTheme(next: Theme) {
    const before = theme;
    const apply = (t: Theme) => {
      setThemeState(t);
      setTheme(t);
    };
    apply(next);
    save({ theme: next }, () => apply(before));
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>
            Where the weather, the holidays and the news are for. Saved to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LocationPicker location={location} />
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="location-consent">Guess my city from my connection</Label>
              <p className="text-muted-foreground text-xs">
                Used when you haven&apos;t picked a city. Off, the dashboard uses Madrid.{" "}
                <Link href="#privacy" className="underline underline-offset-4">
                  Privacy
                </Link>
              </p>
            </div>
            {/* after hydration only: radix renders a hidden input whose style differs between the
                server and the browser when it's on, a same size box holds the place */}
            {hydrated ? (
              <Switch id="location-consent" checked={consent} onCheckedChange={pickConsent} />
            ) : (
              <span className="h-[1.15rem] w-8 shrink-0" aria-hidden />
            )}
          </div>
          {consentError && (
            <p role="alert" className="text-destructive text-sm">
              {consentError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Display</CardTitle>
          <CardDescription>Saved to your account, the same on every device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Choice
            legend="Text size"
            name="text-size"
            options={TEXT_SIZES}
            value={textSize}
            onChange={pickSize}
          />
          <Choice legend="Theme" name="theme" options={THEMES} value={theme} onChange={pickTheme} />
          <p aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
            {status}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** a row of radio buttons styled as a segmented control. real radios, so the arrow keys move
 * between them and a screen reader says "1 of 3" */
function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="bg-muted inline-flex rounded-lg p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "has-focus-visible:ring-ring cursor-pointer rounded-md px-3 py-1.5 text-sm has-focus-visible:ring-2",
              value === o.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
