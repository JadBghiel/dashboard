import { CircleCheck, KeyRound, Link2, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectAccount } from "@/components/services/connect-account";
import { OwnKeyForm } from "@/components/services/own-key-form";
import { githubEnabled } from "@/lib/auth";
import { linkErrorMessage } from "@/lib/link-errors";
import { SECTIONS } from "@/lib/sections";
import { requireUserId } from "@/server/auth/current-user";
import { registry } from "@/server/registry";
import { serviceStatus, setupOf, type ServiceStatus } from "@/server/subscriptions";

export const metadata: Metadata = { title: "Services" };

function StatusBadge({ value, auth }: { value: ServiceStatus; auth: string }) {
  if (value === "needs_account") {
    return (
      <Badge variant="outline" className="gap-1">
        <Link2 className="size-3" aria-hidden /> Needs an account
      </Badge>
    );
  }
  if (value === "linked") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Link2 className="size-3 text-emerald-500" aria-hidden /> Ready, account connected
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

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ link_error?: string; error?: string }>;
}) {
  const { link_error, error } = await searchParams;
  const catalog = registry.catalog;
  const userId = await requireUserId();
  // the user's saved keys as their last 4 characters, and their linked accounts
  const { keyHints, linked, statusOf } = await setupOf(userId);
  const widgets = catalog.reduce((n, s) => n + s.widgets.length, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Services</h1>
        <p className="text-muted-foreground text-sm">
          {catalog.length} services, {widgets} widgets. The ones that need a key or an account are
          set up here.
        </p>
        {link_error && (
          <p role="alert" className="text-destructive text-sm">
            {linkErrorMessage("GitHub", error)}
          </p>
        )}
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
                // id: the locked widget cards link here, /services#market
                <Card key={s.id} id={s.id} className="shadow-soft scroll-mt-20">
                  <CardHeader>
                    <CardTitle>{s.name}</CardTitle>
                    <CardDescription>{s.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatusBadge value={statusOf(registry.getService(s.id)!)} auth={s.auth} />
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
                        hint={keyHints.get(s.id) ?? null}
                        // without a server key, removing yours locks the service again
                        appKey={serviceStatus(registry.getService(s.id)!, false) === "ready"}
                      />
                    )}
                    {s.auth === "oauth" && (
                      <ConnectAccount
                        provider="github"
                        name={s.name}
                        accountId={linked.get(s.id) ?? null}
                        enabled={githubEnabled}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
