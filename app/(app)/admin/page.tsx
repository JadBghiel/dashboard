import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { isAdmin } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  // a 404 for everyone else, the page doesnt even admit it exists
  if (!(await isAdmin(await headers()))) notFound();

  return (
    <div className="space-y-1">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="text-muted-foreground text-sm">manage users, roles and bans</p>
    </div>
  );
}
