"use client";

/** edit profile (#47): name and username are saved right away, the email needs the 2 step check in
 * lib/auth.ts (the current address approves, the new 1 confirms) before it changes */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";

type Status = { ok: boolean; text: string } | null;

export function ProfileCard({
  name,
  image,
  username,
  email,
  emailStatus,
}: {
  name: string;
  // google's picture, null for an account that never used google
  image: string | null;
  username: string | null;
  email: string;
  // set when the user lands back here from an email change link
  emailStatus: Status;
}) {
  return (
    <Card id="profile" className="shadow-soft">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your name, your username and the email we write to.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3">
          <UserAvatar name={name} image={image} size="lg" />
          <p className="text-muted-foreground text-sm">
            {image
              ? "Your picture comes from your Google account."
              : "Connect Google below to use your Google picture here."}
          </p>
        </div>
        <NameForm name={name} username={username} />
        <Separator />
        <EmailForm email={email} initialStatus={emailStatus} />
      </CardContent>
    </Card>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      role={status.ok ? "status" : "alert"}
      className={status.ok ? "text-sm" : "text-destructive text-sm"}
    >
      {status.text}
    </p>
  );
}

function NameForm({
  name: savedName,
  username: savedUsername,
}: {
  name: string;
  username: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(savedName);
  const [username, setUsername] = useState(savedUsername ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const changed = name.trim() !== savedName || username.trim() !== (savedUsername ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const { error } = await authClient.updateUser({
      name: name.trim(),
      // only sent when it changed: the plugin checks it's free, an unchanged 1 would be "taken"
      ...(username.trim() !== (savedUsername ?? "") && { username: username.trim() }),
    });
    setBusy(false);
    if (error) {
      setStatus({ ok: false, text: error.message ?? "Something went wrong." });
      return;
    }
    setStatus({ ok: true, text: "Saved." });
    // the sidebar and the page show the name, they re-read it
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-username">Username</Label>
        <Input
          id="profile-username"
          autoComplete="username"
          minLength={3}
          maxLength={30}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-describedby="profile-username-help"
        />
        <p id="profile-username-help" className="text-muted-foreground text-xs">
          3 to 30 letters, numbers, dots or underscores. You can log in with it.
        </p>
      </div>
      <StatusLine status={status} />
      <Button type="submit" disabled={busy || !changed}>
        {busy ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}

function EmailForm({ email, initialStatus }: { email: string; initialStatus: Status }) {
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(initialStatus);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const { error } = await authClient.changeEmail({
      newEmail: newEmail.trim(),
      // both links of the change land back here, the page says what happened
      callbackURL: "/settings?email=confirmed",
    });
    setBusy(false);
    if (error) {
      setStatus({ ok: false, text: error.message ?? "Something went wrong." });
      return;
    }
    setNewEmail("");
    setStatus({
      ok: true,
      // the same answer whether or not the new address is free, the mail to the current 1 says which
      text: `Check ${email}: there's either a link to approve the change, or a note saying why the new address can't be used.`,
    });
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="profile-email">New email</Label>
        <Input
          id="profile-email"
          type="email"
          autoComplete="email"
          placeholder={email}
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          aria-describedby="profile-email-help"
          required
        />
        <p id="profile-email-help" className="text-muted-foreground text-xs">
          Currently {email}. The change needs a click in both your current and your new inbox.
        </p>
      </div>
      <StatusLine status={status} />
      <Button type="submit" variant="outline" disabled={busy}>
        {busy ? "Sending..." : "Change email"}
      </Button>
    </form>
  );
}
