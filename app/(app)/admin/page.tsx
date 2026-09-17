import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="space-y-1">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="text-muted-foreground text-sm">manage users, roles and bans</p>
    </div>
  );
}
