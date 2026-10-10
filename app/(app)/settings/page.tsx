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
import { SecurityCard } from "@/components/settings/security-card";
import { currentUserId } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Settings & privacy" };

export default async function SettingsPage() {
  const head = await headers();
  const jar = await cookies();
  const [display, { location, consent }, userId] = await Promise.all([
    displaySettings(head),
    locationState(head, (name) => jar.get(name)?.value),
    currentUserId(head),
  ]);
  // a google only account has no "credential" row, so no password to change
  const hasPassword =
    !!userId &&
    !!(await db.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true },
    }));

  return (
    <div className="space-y-8">
      <div id="settings" className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings & privacy</h1>
        <p className="text-muted-foreground text-sm">
          Your location, how the dashboard looks, and what we keep about you.
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
      {display.signedIn && <SecurityCard hasPassword={hasPassword} />}
      {display.signedIn && <DeleteAccountCard />}
      <PrivacyNotice />
    </div>
  );
}
