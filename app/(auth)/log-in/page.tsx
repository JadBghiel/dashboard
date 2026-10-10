import type { Metadata } from "next";

import { LogInForm } from "@/components/auth/log-in-form";
import { googleEnabled } from "@/lib/auth";

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
  const { error } = await searchParams;
  const oauthError = error
    ? (OAUTH_ERRORS[error] ?? "Google sign in didn't work, try again or use your password.")
    : null;
  return <LogInForm googleEnabled={googleEnabled} initialError={oauthError} />;
}
