import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          widgets will be here and will refresh independently
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-card text-card-foreground shadow-soft rounded-xl border p-6"
            aria-hidden
          >
            <div className="bg-muted h-4 w-24 rounded-md" />
            <div className="bg-muted mt-4 h-10 w-32 rounded-lg" />
            <div className="bg-muted mt-4 h-3 w-full rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
