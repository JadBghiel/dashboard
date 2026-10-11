"use client";

/** connect / disconnect an outside account through oauth2 (#19). connect sends the browser to the
 * provider and back to the same page, linked to the signed in user. a failed link lands on the
 * services page, which says why */

import { Link2, Unlink } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { linkAccount, unlinkAccount } from "@/lib/account-actions";

export function ConnectAccount({
  provider,
  name,
  accountId,
  enabled,
}: {
  provider: "github";
  name: string;
  // the linked account's row, null = not linked
  accountId: string | null;
  // false when the server has no oauth client for it (the docker stack w/o github values)
  enabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    const failure = await linkAccount(provider, pathname, `/services?link_error=${provider}`);
    // on success the browser is already leaving for the provider
    if (failure) {
      setBusy(false);
      setError(failure);
    }
  }

  async function disconnect() {
    if (!accountId) return;
    setBusy(true);
    setError(null);
    const failure = await unlinkAccount(accountId);
    setBusy(false);
    if (failure) setError(failure);
    else router.refresh();
  }

  if (!enabled) {
    return (
      <p className="text-muted-foreground text-xs">
        {name} isn&apos;t set up on this server (no OAuth client).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {accountId ? (
        <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>
          <Unlink /> Disconnect {name}
        </Button>
      ) : (
        <Button size="sm" onClick={connect} disabled={busy}>
          <Link2 /> {busy ? "Opening…" : `Connect ${name}`}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
