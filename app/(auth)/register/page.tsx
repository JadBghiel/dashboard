"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name, username, email, password });

    setLoading(false);
    if (error) {
      setError(error.message ?? "Something went wrong.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          We sent a confirmation link to {email}. Click it to activate your account.
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-xl font-semibold">Register</h1>

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={30}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : "Register"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/log-in" className="underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
