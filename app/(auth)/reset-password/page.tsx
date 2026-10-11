import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

// the link in the mail goes through better-auth, which sends the browser here w/ ?token= when it's
// still good, or ?error=INVALID_TOKEN when it's expired or already used
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  if (error || !token) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold">Link expired</h1>
        <p className="text-muted-foreground text-sm">
          This reset link is invalid or has expired. Ask for a new one.
        </p>
        <Link href="/forgot-password" className="text-sm underline">
          Get a new link
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
