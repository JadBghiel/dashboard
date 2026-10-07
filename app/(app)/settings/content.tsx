"use client";

import { useSession } from "@/lib/auth-client";
import { DeleteAccount } from "./delete-account";

export function SettingsContent() {
  const { data: session, isPending } = useSession();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">profile, location, timezone etc</p>
      </div>

      {!isPending && session && <DeleteAccount />}
    </div>
  );
}
