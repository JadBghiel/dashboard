import Link from "next/link";

const MESSAGES: Record<string, string> = {
  invalid_token: "This confirmation link is invalid.",
  token_expired: "This confirmation link has expired. Please register again.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
