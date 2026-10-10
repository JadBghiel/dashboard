"use client";

import { History } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OnThisDayPayload } from "@/server/services/tools/widgets";

import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

type Type = OnThisDayPayload["type"];
type Props = {
  type?: Type;
  count?: number;
  language?: "en" | "fr" | "es" | "de" | "it" | "pt";
  // saves an in-card change to the user's widget, set on the dashboard
  onChange?: (patch: Record<string, unknown>) => void;
};

export function OnThisDayCard({ type = "events", count = 5, language = "en", onChange }: Props) {
  const [kind, setKind] = useState<Type>(type);
  const { data, error, loading, refresh } = useWidgetData<OnThisDayPayload>(
    "tools",
    "on_this_day",
    { type: kind, count, language },
    "",
  );

  return (
    <WidgetCard
      icon={<History className="size-5 text-orange-500" aria-hidden />}
      title="On this day"
      subtitle={data?.day}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
    >
      {data && (
        <div className="space-y-2">
          <Tabs
            value={kind}
            onValueChange={(v) => {
              setKind(v as Type);
              onChange?.({ type: v });
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="births">Births</TabsTrigger>
              <TabsTrigger value="deaths">Deaths</TabsTrigger>
            </TabsList>
          </Tabs>
          <ol className="space-y-2" aria-live="polite">
            {data.items.map((item) => (
              <li key={`${item.year}-${item.text}`} className="flex gap-3 text-sm">
                <span className="text-muted-foreground w-10 shrink-0 font-semibold tabular-nums">
                  {item.year ?? "?"}
                </span>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {item.text}
                  </a>
                ) : (
                  <span>{item.text}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </WidgetCard>
  );
}
