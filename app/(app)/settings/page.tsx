import type { Metadata } from "next";
import { headers } from "next/headers";
import { Download } from "lucide-react";
import { PrivacyNotice } from "@/components/settings/privacy-notice";
import { SettingsForm } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserId } from "@/server/auth/current-user";
import { locationState } from "@/server/user-location";
import { displaySettings } from "@/server/user-settings";
import { DeleteAccountCard } from "@/components/settings/delete-account";
import { ConnectionsCard, type SavedKey } from "@/components/settings/connections-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { SecurityCard } from "@/components/settings/security-card";
import { googleEnabled } from "@/lib/auth";
import { linkErrorMessage } from "@/lib/link-errors";
import { db } from "@/server/db";
import { registry } from "@/server/registry";
import { setupOf } from "@/server/subscriptions";

export const metadata: Metadata = { title: "Settings & privacy" };

// better-auth's codes, appended to the email change link's callback (?error=TOKEN_EXPIRED)
const EMAIL_ERRORS: Record<string, string> = {
  TOKEN_EXPIRED: "That email change link has expired. Ask for the change again.",
  INVALID_TOKEN: "That email change link is invalid. Ask for the change again.",
};

/** what the user sees after clicking a link of the email change, null when they didn't */
function emailStatus(params: { email?: string; error?: string }) {
  if (params.error) {
    return {
      ok: false,
      text:
        EMAIL_ERRORS[params.error] ?? "We couldn't change your email. Ask for the change again.",
    };
  }
  if (params.email !== "confirmed") return null;
  return {
    ok: true,
    text: "Confirmed. If you approved the change from your old address, open the link we just sent to the new one to finish.",
  };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; link_error?: string }>;
}) {
  const params = await searchParams;
  // a refused google link comes back w/ ?link_error=google&error=..., the other ?error= are the
  // email change's
  const linkError = params.link_error ? linkErrorMessage("Google", params.error) : null;
  const userId = await requireUserId();
  const head = await headers();
  // everything the account cards show
  const [display, { location, consent }, user, { keyHints, accounts }] = await Promise.all([
    displaySettings(head),
    locationState(head),
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, image: true, username: true, displayUsername: true, email: true },
    }),
    setupOf(userId),
  ]);
  // a google only account has no "credential" row, so no password to change
  const hasPassword = accounts.some((a) => a.providerId === "credential");
  const keys: SavedKey[] = [...keyHints].map(([serviceId, hint]) => {
    const service = registry.getService(serviceId);
    return {
      serviceId,
      serviceName: service?.name ?? serviceId,
      label: service?.key?.label ?? "API key",
      hint,
    };
  });

  return (
    <div className="space-y-8">
      <div id="settings" className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings & privacy</h1>
        <p className="text-muted-foreground text-sm">
          Your profile, your location, how the dashboard looks, and what we keep about you.
        </p>
      </div>
      <SettingsForm
        location={location}
        consent={consent === true}
        textSize={display.textSize}
        theme={display.theme}
      />

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Everything we store about you, your account, settings and widgets, in 1 JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            {/* a plain link, the server answers w/ a file to save */}
            <a href="/api/account/export" download>
              <Download /> Download my data
            </a>
          </Button>
        </CardContent>
      </Card>
      {user && (
        <ProfileCard
          name={user.name}
          image={user.image}
          username={user.displayUsername ?? user.username}
          email={user.email}
          emailStatus={params.link_error ? null : emailStatus(params)}
        />
      )}
      {user && (
        <ConnectionsCard
          keys={keys}
          accounts={accounts}
          googleEnabled={googleEnabled}
          linkError={linkError}
        />
      )}
      <SecurityCard hasPassword={hasPassword} />
      <DeleteAccountCard />
      <PrivacyNotice />
    </div>
  );
}
