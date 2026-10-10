import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";
import { googleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return <RegisterForm googleEnabled={googleEnabled} />;
}
