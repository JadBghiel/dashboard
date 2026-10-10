import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Download } from "lucide-react";
import { PrivacyNotice } from "@/components/settings/privacy-notice";
import { SettingsForm } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { locationState } from "@/server/user-location";
import { displaySettings } from "@/server/user-settings";
import { DeleteAccountCard } from "@/components/settings/delete-account";
import { ConnectionsCard, type SavedKey } from "@/components/settings/connections-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { SecurityCard } from "@/components/settings/security-card";
import { googleEnabled } from "@/lib/auth";
import { currentUserId } from "@/server/auth/current-user";
import { listHints } from "@/server/credential-store";
import { db } from "@/server/db";
import { registry } from "@/server/registry";

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
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const head = await headers();
  const jar = await cookies();
  const [display, { location, consent }, userId] = await Promise.all([
    displaySettings(head),
    locationState(head, (name) => jar.get(name)?.value),
    currentUserId(head),
  ]);
  // everything the account cards show, only for a signed in user
  const [user, accounts, hints] = userId
    ? await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          select: { name: true, username: true, displayUsername: true, email: true },
        }),
        db.account.findMany({
          where: { userId },
          select: { id: true, providerId: true },
          orderBy: { createdAt: "asc" },
        }),
        listHints(userId),
      ])
    : [null, [], []];
  // a google only account has no "credential" row, so no password to change
  const hasPassword = accounts.some((a) => a.providerId === "credential");
  const keys: SavedKey[] = hints.map((h) => {
    const service = registry.getService(h.serviceId);
    return {
      serviceId: h.serviceId,
      serviceName: service?.name ?? h.serviceId,
      label: service?.key?.label ?? "API key",
      hint: h.hint,
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
        signedIn={display.signedIn}
        location={location}
        consent={consent === true}
        textSize={display.textSize}
        theme={display.theme}
      />

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            {display.signedIn
              ? "Everything we store about you, your account, settings and widgets, in 1 JSON file."
              : "Sign in to download the data we store about you."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {display.signedIn ? (
            <Button asChild variant="outline">
              {/* a plain link, the server answers w/ a file to save */}
              <a href="/api/account/export" download>
                <Download /> Download my data
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <Download /> Download my data
            </Button>
          )}
        </CardContent>
      </Card>
      {user && (
        <ProfileCard
          name={user.name}
          username={user.displayUsername ?? user.username}
          email={user.email}
          emailStatus={emailStatus(await searchParams)}
        />
      )}
      {user && <ConnectionsCard keys={keys} accounts={accounts} googleEnabled={googleEnabled} />}
      {display.signedIn && <SecurityCard hasPassword={hasPassword} />}
      {display.signedIn && <DeleteAccountCard />}
      <PrivacyNotice />
    </div>
  );
}
