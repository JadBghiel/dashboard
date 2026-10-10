import { CircleCheck, KeyRound, Link2, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnKeyForm } from "@/components/services/own-key-form";
import { currentUserId } from "@/server/auth/current-user";
import { listHints } from "@/server/credential-store";
import { registry } from "@/server/registry";
import type { ServiceCategory } from "@/server/registry/define";
import { serviceStatus, type ServiceStatus } from "@/server/subscriptions";

export const metadata: Metadata = { title: "Services" };

const SECTIONS: { id: ServiceCategory; title: string }[] = [
  { id: "utility", title: "Utility" },
  { id: "news", title: "News" },
  { id: "games", title: "Games" },
];

function StatusBadge({ value, auth }: { value: ServiceStatus; auth: string }) {
  if (value === "needs_account") {
    return (
      <Badge variant="outline" className="gap-1">
        <Link2 className="size-3" aria-hidden /> Needs an account
      </Badge>
    );
  }
  if (value === "own_key") {
    return (
      <Badge variant="secondary" className="gap-1">
        <KeyRound className="size-3 text-emerald-500" aria-hidden /> Ready, your own key
      </Badge>
    );
  }
  if (value === "missing_key") {
    return (
      <Badge variant="destructive" className="gap-1">
        <TriangleAlert className="size-3" aria-hidden /> Add your key to use it
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      {auth === "api_key" ? (
        <KeyRound className="size-3 text-emerald-500" aria-hidden />
      ) : (
        <CircleCheck className="size-3 text-emerald-500" aria-hidden />
      )}
      {auth === "api_key" ? "Ready, app key" : "Ready, nothing to set up"}
    </Badge>
  );
}

export default async function ServicesPage() {
  const catalog = registry.catalog;
  const userId = await currentUserId(await headers());
  // the user's saved keys, as their last 4 characters
  const hints = new Map(userId ? (await listHints(userId)).map((k) => [k.serviceId, k.hint]) : []);
  const widgets = catalog.reduce((n, s) => n + s.widgets.length, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Services</h1>
        <p className="text-muted-foreground text-sm">
          {catalog.length} services, {widgets} widgets. The ones that need a key or an account are
          set up here.
        </p>
      </div>

      {SECTIONS.map((section) => {
        const services = catalog.filter((s) => s.category === section.id);
        if (services.length === 0) return null;
        return (
          <section
            key={section.id}
            aria-labelledby={`services-${section.id}`}
            className="space-y-3"
          >
            <h2
              id={`services-${section.id}`}
              className="font-heading text-lg font-semibold tracking-tight"
            >
              {section.title}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-4">
              {services.map((s) => (
                <Card key={s.id} className="shadow-soft">
                  <CardHeader>
                    <CardTitle>{s.name}</CardTitle>
                    <CardDescription>{s.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatusBadge
                      value={serviceStatus(registry.getService(s.id)!, hints.has(s.id))}
                      auth={s.auth}
                    />
                    <ul className="space-y-1 text-sm">
                      {s.widgets.map((w) => (
                        <li key={w.id}>
                          <span className="font-medium">{w.name}</span>
                          <span className="text-muted-foreground"> · {w.description}</span>
                        </li>
                      ))}
                    </ul>
                    {s.key && (
                      <OwnKeyForm
                        serviceId={s.id}
                        label={s.key.label}
                        helpUrl={s.key.helpUrl}
                        signedIn={!!userId}
                        hint={hints.get(s.id) ?? null}
                        // without a server key, removing yours locks the service again
                        appKey={serviceStatus(registry.getService(s.id)!, false) === "ready"}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
              {section.id === "utility" && <GitHubPlaceholder />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** github needs oauth2 (#19, #26), not in the registry yet so about.json doesnt list it */
function GitHubPlaceholder() {
  return (
    <Card className="shadow-soft border-dashed">
      <CardHeader>
        <CardTitle>GitHub</CardTitle>
        <CardDescription>Your notifications, activity and profile. Coming soon.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusBadge value="needs_account" auth="oauth" />
        <Button variant="outline" size="sm" disabled>
          <Link2 /> Connect with GitHub (OAuth2)
        </Button>
      </CardContent>
    </Card>
  );
}
