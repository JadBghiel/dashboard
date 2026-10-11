"use client";

/** change the password and sign out of every device (#9). a new password signs out every other
 * device, so a leaked one stops working everywhere the moment it's changed. google accounts have no
 * password here, they only get the sign out */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function SecurityCard({ hasPassword }: { hasPassword: boolean }) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>
          {hasPassword
            ? "Change your password, or sign out on every device you're signed in on."
            : "You sign in with Google, so there's no password to change here."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasPassword && <ChangePasswordForm />}
        <SignOutEverywhere />
      </CardContent>
    </Card>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (next !== confirm) {
      setMessage({ ok: false, text: "The new passwords don't match." });
      return;
    }
    setBusy(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      // the server ends every other session and keeps this one signed in on a fresh session
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: error.message ?? "Something went wrong." });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setMessage({ ok: true, text: "Password changed. Your other devices are signed out." });
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-describedby="new-password-help"
          required
        />
        <p id="new-password-help" className="text-muted-foreground text-xs">
          At least 12 characters, not a common password, without your username or email.
        </p>
      </div>
      <div className="space-y-1.5">
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
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-sm" : "text-destructive text-sm"}
        >
          {message.text}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Changing..." : "Change password"}
      </Button>
    </form>
  );
}

function SignOutEverywhere() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOutEverywhere() {
    setBusy(true);
    setError(null);
    // ends every session of the account, this one included
    const { error } = await authClient.revokeSessions();
    if (error) {
      setBusy(false);
      setError(error.message ?? "Something went wrong.");
      return;
    }
    // the session is already gone on the server, this clears the cookie and the page's own copy, so
    // the sidebar doesn't still show the user
    await authClient.signOut();
    router.push("/log-in");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        Lost a device or signed in somewhere you shouldn&apos;t have? This signs you out everywhere,
        including here.
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button variant="outline" onClick={signOutEverywhere} disabled={busy}>
        <LogOut />
        {busy ? "Signing out..." : "Sign out everywhere"}
      </Button>
    </div>
  );
}
