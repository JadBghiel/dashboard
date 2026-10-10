"use client";

/** #47 key and account management: the api keys the user saved (#17, hints only) and the ways they
 * log in. removing a key is the same as on the services page, unlinking an oauth account is
 * better-auth's, which refuses to unlink the last way in */

import { KeyRound, Link2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export type SavedKey = { serviceId: string; serviceName: string; label: string; hint: string };

// better-auth's provider ids, as the user knows them
const PROVIDERS: Record<string, string> = { credential: "Email and password", google: "Google" };

// 1 way to log in: the account row's id (what unlink takes) and its provider ("credential" = password)
export type LoginAccount = { id: string; providerId: string };

export function ConnectionsCard({
  keys,
  accounts,
  googleEnabled,
}: {
  keys: SavedKey[];
  accounts: LoginAccount[];
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: () => Promise<string | null>) {
    setBusy(id);
    setError(null);
    const failure = await action();
    setBusy(null);
    if (failure) setError(failure);
    else router.refresh();
  }

  const removeKey = (serviceId: string) =>
    act(`key-${serviceId}`, async () => {
      const res = await api.credentials[":serviceId"]
        .$delete({ param: { serviceId } })
        .catch(() => null);
      return res?.ok ? null : "Could not remove the key, try again.";
    });

  const unlink = (account: LoginAccount) =>
    act(`account-${account.providerId}`, async () => {
      // only looked up among the signed in user's own accounts
      const { error } = await authClient.unlinkAccount({ accountId: account.id });
      return error ? (error.message ?? "Something went wrong.") : null;
    });

  // leaves for google's consent screen and comes back here once linked
  const connectGoogle = () =>
    act("account-google", async () => {
      const { error } = await authClient.linkSocial({
        provider: "google",
        callbackURL: "/settings",
      });
      return error ? (error.message ?? "Something went wrong.") : null;
    });

  return (
    <Card id="connections" className="shadow-soft">
      <CardHeader>
        <CardTitle>Keys and connected accounts</CardTitle>
        <CardDescription>
          The API keys you saved and the ways you log in. Remove any of them at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section aria-labelledby="keys-title" className="space-y-2">
          <h3 id="keys-title" className="text-sm font-medium">
            Your API keys
          </h3>
          {keys.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No saved keys. You can add your own on the{" "}
              <Link href="/services" className="underline underline-offset-4">
                Services page
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {keys.map((k) => (
                <li key={k.serviceId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <KeyRound className="size-4 text-emerald-500" aria-hidden />
                    <span>
                      {k.serviceName} · {k.label} ending in{" "}
                      <span className="font-mono">••••{k.hint}</span>
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === `key-${k.serviceId}`}
                    onClick={() => removeKey(k.serviceId)}
                    aria-label={`Remove your ${k.serviceName} key`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Lock className="size-3" aria-hidden /> Stored encrypted, only the last 4 characters are
            ever shown back.
          </p>
        </section>

        <section aria-labelledby="accounts-title" className="space-y-2">
          <h3 id="accounts-title" className="text-sm font-medium">
            How you log in
          </h3>
          <ul className="divide-y rounded-lg border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  {PROVIDERS[a.providerId] ?? a.providerId}
                  {accounts.length === 1 && <Badge variant="secondary">Your only way in</Badge>}
                </span>
                {/* the password isn't a linked account, and the last way in can't be removed */}
                {a.providerId !== "credential" && accounts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === `account-${a.providerId}`}
                    onClick={() => unlink(a)}
                    aria-label={`Unlink ${PROVIDERS[a.providerId] ?? a.providerId}`}
                  >
                    Unlink
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {googleEnabled && !accounts.some((a) => a.providerId === "google") && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy === "account-google"}
              onClick={connectGoogle}
            >
              <Link2 /> Connect Google
            </Button>
          )}
        </section>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
