"use client";

import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { HolidaysPayload } from "@/server/services/tools/widgets";

import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

type Props = {
  // empty = the user's country
  country?: string;
  count?: number;
  locationKey: string;
};

// the 2 letters of an iso code, as the matching regional indicator symbols: FR -> 🇫🇷
const flag = (code: string) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const countryName = (code: string) =>
  new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;

// yyyy-mm-dd is a calendar day, read in local time so it isnt shifted by the utc offset
function day(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function inDays(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const n = Math.round((day(date).getTime() - today.getTime()) / 86_400_000);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `In ${n} days`;
}

export function HolidaysCard({ country = "", count = 5, locationKey }: Props) {
  const { data, error, loading, refresh } = useWidgetData<HolidaysPayload>(
    "tools",
    "public_holidays",
    { country, count },
    locationKey,
  );

  return (
    <WidgetCard
      icon={<CalendarDays className="size-5 text-rose-500" aria-hidden />}
      title="Public holidays"
      subtitle={data ? `${flag(data.country)} ${countryName(data.country)}` : undefined}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
    >
      {data &&
        (data.items.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No more holidays this year.
          </p>
        ) : (
          <ul className="divide-y" aria-live="polite">
            {data.items.map((h) => (
              <li key={`${h.date}-${h.name}`} className="flex items-start gap-3 py-2">
                <span className="bg-muted flex w-11 shrink-0 flex-col items-center rounded-lg py-1">
                  <span className="text-muted-foreground text-[10px] uppercase">
                    {day(h.date).toLocaleDateString(undefined, { month: "short" })}
                  </span>
                  <span className="text-base leading-none font-semibold">
                    {day(h.date).getDate()}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{h.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {h.localName !== h.name ? `${h.localName} · ` : ""}
                    {inDays(h.date)}
                  </span>
                </span>
                {h.regional && (
                  <Badge variant="outline" className="shrink-0">
                    Regional
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        ))}
    </WidgetCard>
  );
}
