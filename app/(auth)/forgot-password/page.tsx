import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { currentUserId } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  // signed in, the password is changed from settings
  if (await currentUserId(await headers())) redirect("/settings");
  return <ForgotPasswordForm />;
}
