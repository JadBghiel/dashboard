"use client";

/** delete account in 2 steps: typing the account email confirms the intent (no misclick wipes an
 * account), then a link mailed to that address does the actual deletion. the mail is the real proof,
 * it works for google accounts that have no password, and a stolen session alone can't use it */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, useSession } from "@/lib/auth-client";

export function DeleteAccountCard() {
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accountEmail = session?.user.email ?? "";
  const matches = email.trim().toLowerCase() === accountEmail.toLowerCase() && email.trim() !== "";

  async function handleDelete() {
    setLoading(true);
    setError(null);

    const { error } = await authClient.deleteUser({ callbackURL: "/account-deleted" });

    setLoading(false);

    if (error) {
      setError(error.message ?? "Something went wrong.");
      return;
    }

    setSent(true);
  }

  function cancel() {
    setConfirming(false);
    setEmail("");
    setError(null);
  }

  return (
    <div className="border-destructive/50 space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">Delete account</h2>
        <p className="text-muted-foreground text-sm">
          This permanently deletes your account and all its data. This cannot be undone.
        </p>
      </div>

      {sent ? (
        <p role="status" className="text-sm">
          We sent a confirmation link to <span className="font-medium">{accountEmail}</span>. Open
          it in this browser within 24 hours to delete your account.
        </p>
      ) : !confirming ? (
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete my account
        </Button>
      ) : (
        <div className="space-y-2">
          <label htmlFor="delete-email" className="text-sm font-medium">
            Type your email <span className="font-mono">{accountEmail}</span> to confirm
          </label>
          <Input
            id="delete-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby="delete-email-help"
          />
          <p id="delete-email-help" className="text-muted-foreground text-xs">
            We&apos;ll email you a link, your account is only deleted once you click it.
          </p>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleDelete} disabled={loading || !matches}>
              {loading ? "Sending..." : "Send the confirmation link"}
            </Button>
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
