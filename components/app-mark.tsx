/** the app's logo, a dashboard icon in a primary square. the sidebar and the auth pages share it */

import { LayoutDashboard } from "lucide-react";

import { cn } from "@/lib/utils";

export function AppMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg",
        className,
      )}
    >
      <LayoutDashboard className="size-1/2" aria-hidden />
    </div>
  );
}
