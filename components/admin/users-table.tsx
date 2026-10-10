"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type User = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  emailVerified: boolean;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  // the services the user subscribed to w/ their own key
  subscriptions: number;
};

export function UsersTable({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [banningId, setBanningId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  // the user whose action is being saved, their buttons wait so a double click cant send it twice
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = users.filter((u) =>
    [u.name, u.email, u.username ?? ""].some((field) => field.toLowerCase().includes(q)),
  );

  // runs 1 admin action, the server has the final say on every rule (lib/auth.ts)
  async function run(user: User, action: () => Promise<{ error: { message?: string } | null }>) {
    setError(null);
    setBusyId(user.id);
    const { error } = await action();
    setBusyId(null);
    if (error) {
      setError(error.message ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function toggleRole(user: User) {
    const nextRole = user.role === "admin" ? "user" : "admin";
    await run(user, () => authClient.admin.setRole({ userId: user.id, role: nextRole }));
  }

  async function unban(user: User) {
    await run(user, () => authClient.admin.unbanUser({ userId: user.id }));
  }

  async function confirmBan(user: User) {
    const banned = await run(user, () =>
      authClient.admin.banUser({
        userId: user.id,
        banReason: banReason.trim() || "No reason given",
      }),
    );
    if (banned) {
      setBanningId(null);
      setBanReason("");
    }
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        aria-label="Search users"
        placeholder="Search by name, email or username..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  {/* google accounts have no username */}
                  {user.username && (
                    <span className="text-muted-foreground text-sm">@{user.username}</span>
                  )}
                  {user.role === "admin" && <Badge variant="secondary">Admin</Badge>}
                  {!user.emailVerified && <Badge variant="outline">Unverified</Badge>}
                  {user.banned && <Badge variant="destructive">Banned</Badge>}
                </div>
                <p className="text-muted-foreground text-sm">
                  {user.email} ·{" "}
                  {user.subscriptions === 1
                    ? "1 subscription"
                    : `${user.subscriptions} subscriptions`}
                </p>
                {user.banned && user.banReason && (
                  <p className="text-muted-foreground text-xs">Reason: {user.banReason}</p>
                )}
              </div>

              <fieldset disabled={busyId === user.id} className="flex items-center gap-2">
                {!isSelf && (
                  <Button variant="outline" size="sm" onClick={() => toggleRole(user)}>
                    {user.role === "admin" ? "Demote" : "Promote"}
                  </Button>
                )}

                {user.banned ? (
                  <Button variant="outline" size="sm" onClick={() => unban(user)}>
                    Unban
                  </Button>
                ) : !isSelf ? (
                  banningId === user.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Reason for banning ${user.name}`}
                        placeholder="Reason"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        className="h-8 w-40"
                      />
                      <Button variant="destructive" size="sm" onClick={() => confirmBan(user)}>
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBanningId(null);
                          setBanReason("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button variant="destructive" size="sm" onClick={() => setBanningId(user.id)}>
                      Ban
                    </Button>
                  )
                ) : null}
              </fieldset>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">No users match.</p>
        )}
      </div>
    </div>
  );
}
