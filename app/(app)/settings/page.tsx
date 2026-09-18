import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-1">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-muted-foreground text-sm">profile, location, timezone etc</p>
    </div>
  );
}
