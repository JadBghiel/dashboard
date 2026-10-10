import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Account deleted" };

// where the deletion link from the mail lands once better-auth has wiped the account
export default function AccountDeletedPage() {
  return (
    <div className="space-y-2 text-center">
      <h1 className="text-xl font-semibold">Account deleted</h1>
      <p className="text-muted-foreground text-sm">
        Your account and all its data are gone. Thanks for trying the dashboard.
      </p>
      <Link href="/dashboard" className="text-sm underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
