"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { GoogleButton } from "./google-button";

export function LogInForm({
  googleEnabled,
  initialError = null,
}: {
  googleEnabled: boolean;
  // why the last google sign in was refused, from ?error= on the page
  initialError?: string | null;
}) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    //1 field for both: an @ means an email, usernames can't contain one
    const id = login.trim();
    //better-auth sends the browser here after a successful login, and the fresh confirmation link
    //of an unverified one too. the page forwards to the dashboard unless the link failed
    const callbackURL = "/verify-email?from=login";
    const { error } = id.includes("@")
      ? await authClient.signIn.email({ email: id, password, callbackURL })
      : await authClient.signIn.username({ username: id, password, callbackURL });

    setLoading(false);
    if (error) {
      //right password but unconfirmed email: the server just mailed a new link
      setError(
        error.code === "EMAIL_NOT_VERIFIED"
          ? "Your email isn't confirmed yet. We sent you a new link, check your inbox."
          : (error.message ?? "Something went wrong."),
      );
      return;
    }
    router.push("/dashboard");
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h1 className="text-xl font-semibold">Log in</h1>
        <div className="space-y-1">
          <Label htmlFor="login">Username or email</Label>
          <Input
            id="login"
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-muted-foreground text-xs underline">
              Forgot your password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="underline">
            Register
          </Link>
        </p>
      </form>

      {googleEnabled && <GoogleButton />}
    </>
  );
}
