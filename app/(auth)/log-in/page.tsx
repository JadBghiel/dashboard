import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LogInForm } from "@/components/auth/log-in-form";
import { googleEnabled } from "@/lib/auth";
import { currentUserId } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Log in" };

// better-auth's codes when a google sign in is refused, it sends the browser back here w/ ?error=
const OAUTH_ERRORS: Record<string, string> = {
  account_not_linked: "This email already has an account. Log in with your password instead.",
  access_denied: "Google sign in was cancelled.",
};

export default async function LogInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // already signed in, nothing to log in to
  if (await currentUserId(await headers())) redirect("/dashboard");
  const { error } = await searchParams;
  const oauthError = error
    ? (OAUTH_ERRORS[error] ?? "Google sign in didn't work, try again or use your password.")
    : null;
  return <LogInForm googleEnabled={googleEnabled} initialError={oauthError} />;
}
