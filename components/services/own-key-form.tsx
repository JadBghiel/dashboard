"use client";

/** "use your own key" for key services. the key is stored encrypted (#17) and never comes back, only
 * its last 4 characters, so the form shows that hint and a remove btn once one is saved. w/ nobody
 * signed in theres no account to save it to, the form is shown disabled w/ the reason */

import { ExternalLink, KeyRound, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function OwnKeyForm({
  serviceId,
  label,
  helpUrl,
  signedIn,
  hint: savedHint,
}: {
  serviceId: string;
  label: string;
  helpUrl: string;
  signedIn: boolean;
  // last 4 characters of the saved key, null = none saved
  hint: string | null;
}) {
  const router = useRouter();
  const [hint, setHint] = useState(savedHint);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await api.credentials[":serviceId"]
      .$put({ param: { serviceId }, json: { apiKey: value } })
      .catch(() => null);
    setBusy(false);
    const body = res ? await res.json() : null;
    if (!body || !("hint" in body)) {
      return setMessage(body?.message ?? "Could not save the key, try again.");
    }
    setHint(body.hint);
    setValue("");
    setMessage("Saved. Your widgets use your key from now on.");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    const res = await api.credentials[":serviceId"]
      .$delete({ param: { serviceId } })
      .catch(() => null);
    setBusy(false);
    if (!res?.ok) return setMessage("Could not remove the key, try again.");
    setHint(null);
    setMessage("Removed. Your widgets use the app's key again.");
    router.refresh();
  }

  return (
    <div className="bg-muted/40 space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Use your own {label}</p>
      <p className="text-muted-foreground text-xs">
        Optional. With your own key your widgets don&apos;t share the app&apos;s free quota. It is
        stored encrypted and only its last 4 characters are ever shown back.
      </p>

      {hint && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5">
            <KeyRound className="size-4 text-emerald-500" aria-hidden />
            Your key ending in <span className="font-mono">••••{hint}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
            Remove
          </Button>
        </div>
      )}

      <form onSubmit={save}>
        <fieldset disabled={!signedIn || busy} className="flex gap-2">
          <Input
            type="password"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              signedIn
                ? hint
                  ? "Paste a new key to replace it"
                  : "Paste your key"
                : "Sign in to add your key"
            }
            aria-label={label}
          />
          <Button type="submit">Save</Button>
        </fieldset>
      </form>

      <p className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
        <span aria-live="polite" className="flex items-center gap-1">
          {!signedIn && <Lock className="size-3" aria-hidden />}
          {signedIn ? message : "Available once you're signed in"}
        </span>
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground inline-flex shrink-0 items-center gap-1 underline-offset-4 hover:underline"
        >
          Get a free key
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    </div>
  );
}
