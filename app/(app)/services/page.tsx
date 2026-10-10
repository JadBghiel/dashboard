"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Service = {
  id: string;
  name: string;
  description: string;
  auth: "none" | "api_key" | "oauth";
  status: "ready" | "missing_key" | "needs_account";
  subscribed: boolean;
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [keyInputFor, setKeyInputFor] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/services");
    const data = await res.json();
    setServices(data.services);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function subscribe(service: Service, key?: string) {
    setError(null);
    const res = await fetch(`/api/services/${service.id}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(key ? { apiKey: key } : {}),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Something went wrong.");
      return;
    }
    setKeyInputFor(null);
    setApiKey("");
    refresh();
  }

  async function unsubscribe(service: Service) {
    setError(null);
    await fetch(`/api/services/${service.id}/subscribe`, { method: "DELETE" });
    refresh();
  }

  if (!services) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Services</h1>
        <p className="text-muted-foreground text-sm">subscribe to unlock their widgets</p>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {services.map((service) => (
          <div key={service.id} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <h2 className="font-medium">{service.name}</h2>
              <p className="text-muted-foreground text-sm">{service.description}</p>
            </div>

            {service.auth === "none" ? (
              <span className="text-muted-foreground text-sm">Always available</span>
            ) : service.auth === "oauth" ? (
              <span className="text-muted-foreground text-sm">OAuth not available yet</span>
            ) : service.subscribed ? (
              <Button variant="outline" onClick={() => unsubscribe(service)}>
                Unsubscribe
              </Button>
            ) : keyInputFor === service.id ? (
              <div className="flex gap-2">
                <Input
                  placeholder="API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-48"
                />
                <Button onClick={() => subscribe(service, apiKey)} disabled={!apiKey}>
                  Confirm
                </Button>
              </div>
            ) : (
              <Button onClick={() => setKeyInputFor(service.id)}>Subscribe</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
