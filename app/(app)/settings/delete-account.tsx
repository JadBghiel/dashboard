"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function DeleteAccount() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    setError(null);

    const { error } = await authClient.deleteUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message ?? "Something went wrong.");
      return;
    }

    router.push("/log-in");
  }

  return (
    <div className="border-destructive/50 space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">Delete account</h2>
        <p className="text-muted-foreground text-sm">
          This permanently deletes your account and all its data. This cannot be undone.
        </p>
      </div>

      {!confirming ? (
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete my account
        </Button>
      ) : (
        <div className="space-y-2">
          <label htmlFor="delete-password" className="text-sm font-medium">
            Enter your password to confirm
          </label>
          <Input
            id="delete-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || password.length === 0}
            >
              {loading ? "Deleting..." : "Confirm deletion"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setConfirming(false);
                setPassword("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
