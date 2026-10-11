import type { Metadata } from "next";

import { PrivacyNotice } from "@/components/settings/privacy-notice";

export const metadata: Metadata = { title: "Privacy" };

// public, unlike the rest of the app: a visitor reads it before registering (gdpr). signed in, the
// same notice is at the bottom of settings & privacy
export default function PrivacyPage() {
  return <PrivacyNotice />;
}
