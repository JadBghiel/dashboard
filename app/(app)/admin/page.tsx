import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { isAdmin, currentUserId } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { UsersTable } from "@/components/admin/users-table"

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const h = await headers();
  if (!(await isAdmin(h))) notFound();

  const [users, myUserId] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        emailVerified: true,
        role: true,
        banned: true,
        banReason: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    currentUserId(h),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground text-sm">manage users, roles and bans</p>
      </div>

      <UsersTable users={users} currentUserId={myUserId} />
    </div>
  );
}
