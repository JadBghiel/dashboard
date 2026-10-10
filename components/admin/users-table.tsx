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

  const adminCount = users.filter((u) => u.role === "admin" && !u.banned).length;

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      (u.username ?? "").toLowerCase().includes(query.toLowerCase()),
  );

  async function toggleRole(user: User) {
    setError(null);
    const nextRole = user.role === "admin" ? "user" : "admin";

    if (nextRole === "user" && user.role === "admin" && adminCount <= 1) {
      setError("Can't demote the last admin.");
      return;
    }

    const { error } = await authClient.admin.setRole({
      userId: user.id,
      role: nextRole,
    });
    if (error) {
      setError(error.message ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function unban(user: User) {
    setError(null);
    const { error } = await authClient.admin.unbanUser({ userId: user.id });
    if (error) {
      setError(error.message ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function confirmBan(user: User) {
    setError(null);

    if (user.role === "admin" && adminCount <= 1) {
      setError("Can't ban the last admin.");
      return;
    }

    const { error } = await authClient.admin.banUser({
      userId: user.id,
      banReason: banReason || "No reason given",
    });
    if (error) {
      setError(error.message ?? "Something went wrong.");
      return;
    }
    setBanningId(null);
    setBanReason("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by email or username..."
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
                  <span className="text-muted-foreground text-sm">@{user.username ?? "—"}</span>
                  {user.role === "admin" && <Badge variant="secondary">Admin</Badge>}
                  {!user.emailVerified && <Badge variant="outline">Unverified</Badge>}
                  {user.banned && <Badge variant="destructive">Banned</Badge>}
                </div>
                <p className="text-muted-foreground text-sm">{user.email}</p>
                {user.banned && user.banReason && (
                  <p className="text-muted-foreground text-xs">Reason: {user.banReason}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
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
              </div>
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
