"use client";

/**  frame for every widget : icon, title, subtitle, refresh, a footer link, loading and error
 * states, the grid in #23 adds the config, remove and drag handles here, the widgets themselves only
 * render content */

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  // small service icon before the title
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  loading: boolean;
  error: string | null;
  // false before the 1st payload, then the content stays visible during a refresh
  hasData: boolean;
  onRefresh: () => void;
  // ex: "open weather", "view all repositories", pinned to the bottom of the card
  footer?: React.ReactNode;
  // extra header buttons next to refresh, like the news settings
  actions?: React.ReactNode;
  // the news panels' monitor look: monospace uppercase title, and a red "live" dot w/ a count
  monitor?: { count?: number };
  className?: string;
  children: React.ReactNode;
};

export function WidgetCard({
  icon,
  title,
  subtitle,
  loading,
  error,
  hasData,
  onRefresh,
  footer,
  actions,
  monitor,
  className,
  children,
}: Props) {
  return (
    // h-full so every card in a grid row is as tall as the tallest, footers line up
    <Card className={cn("shadow-soft h-full", className)} aria-busy={loading}>
      <CardHeader>
        <CardTitle
          className={cn(
            "flex items-center gap-2",
            monitor && "font-mono text-sm tracking-widest uppercase",
          )}
        >
          {icon}
          {title}
          {monitor?.count !== undefined && (
            <span className="flex items-center gap-1 text-xs font-normal text-red-500">
              <span
                className="size-1.5 rounded-full bg-red-500 motion-safe:animate-pulse"
                aria-hidden
              />
              {monitor.count}
              <span className="sr-only">items</span>
            </span>
          )}
        </CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
        <CardAction className="flex items-center">
          {actions}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            aria-label={`Refresh ${title.toLowerCase()}`}
          >
            <RefreshCw className={cn(loading && "animate-spin")} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {hasData ? children : !error && <WidgetSkeleton />}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardContent>
      {footer && hasData && (
        <CardFooter className="border-t-0 bg-transparent pt-0">{footer}</CardFooter>
      )}
    </Card>
  );
}

function WidgetSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-10 w-28" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}
