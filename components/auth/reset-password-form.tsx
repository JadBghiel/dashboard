"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The 2 passwords are different.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      setError(
        error.code === "INVALID_TOKEN"
          ? "This link is invalid or has expired. Ask for a new one."
          : (error.message ?? "Something went wrong."),
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold">Password changed</h1>
        <p className="text-muted-foreground text-sm">
          You were signed out everywhere. Log in with your new password.
        </p>
        <Link href="/log-in" className="text-sm underline">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <div className="space-y-1">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          required
        />
        <p className="text-muted-foreground text-xs">
          At least 12 characters, not a common password.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm-password">Confirm the new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : "Change my password"}
      </Button>
    </form>
  );
}
