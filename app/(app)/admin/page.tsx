import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { isAdmin, currentUserId } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { registry } from "@/server/registry";
import { UsersTable } from "@/components/admin/users-table";

export const metadata: Metadata = { title: "Admin" };

// the oauth services, their provider id is the service id (server/subscriptions.ts)
const OAUTH_PROVIDERS = registry.catalog.filter((s) => s.auth === "oauth").map((s) => s.id);

export default async function AdminPage() {
  const h = await headers();
  if (!(await isAdmin(h))) notFound();

  const [users, myUserId] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        name: true,
        image: true,
        username: true,
        email: true,
        emailVerified: true,
        role: true,
        banned: true,
        banReason: true,
        // a subscription is a saved key (#18) or a linked oauth account (#19), google is a way to
        // log in, not a service
        _count: {
          select: {
            credentials: true,
            accounts: { where: { providerId: { in: OAUTH_PROVIDERS } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    currentUserId(h),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground text-sm">Manage users, roles and bans.</p>
      </div>

      <UsersTable
        users={users.map(({ _count, ...u }) => ({
          ...u,
          subscriptions: _count.credentials + _count.accounts,
        }))}
        currentUserId={myUserId}
      />
    </div>
  );
}
