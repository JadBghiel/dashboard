import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { googleEnabled } from "@/lib/auth";
import { currentUserId } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  // already signed in, nothing to register
  if (await currentUserId(await headers())) redirect("/dashboard");
  return <RegisterForm googleEnabled={googleEnabled} />;
}
