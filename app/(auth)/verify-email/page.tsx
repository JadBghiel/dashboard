import Link from "next/link";
import { redirect } from "next/navigation";

// better-auth's error codes, as it appends them to the callback url (?error=TOKEN_EXPIRED). logging in
// w/ an unconfirmed email mails a fresh link (sendOnSignIn in lib/auth.ts)
const MESSAGES: Record<string, string> = {
  INVALID_TOKEN: "This confirmation link is invalid. Log in to get a new one.",
  TOKEN_EXPIRED: "This confirmation link has expired. Log in to get a new one.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = await searchParams;

  if (error) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold">Confirmation failed</h1>
        <p className="text-muted-foreground text-sm">
          {MESSAGES[error] ?? "We couldn't confirm your account."}
        </p>
        <Link href="/log-in" className="text-sm underline">
          Back to log in
        </Link>
      </div>
    );
  }
  // the login form's callback: a plain login, or the link it mailed, either way the user is in
  if (from === "login") redirect("/dashboard");

  return (
    <div className="space-y-2 text-center">
      <h1 className="text-xl font-semibold">Email confirmed</h1>
      <p className="text-muted-foreground text-sm">Your account is active.</p>
      <Link href="/dashboard" className="text-sm underline">
        Go to your dashboard
      </Link>
    </div>
  );
}
