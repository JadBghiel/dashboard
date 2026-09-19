import type { Metadata } from "next";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <div className="space-y-1">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Services</h1>
      <p className="text-muted-foreground text-sm">
        connect here the services the widgets will use
      </p>
    </div>
  );
}
