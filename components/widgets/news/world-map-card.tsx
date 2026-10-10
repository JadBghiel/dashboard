"use client";

/** the "global situation" map: earthquakes and nasa's natural events as dots on a world outline.
 * the outline is drawn from a small bundled atlas (no map tiles, no key), the dots come from
 * /api/widgets/news/world_events. hovering a dot names it, the list under the map links to each */

import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { useState } from "react";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries from "world-atlas/countries-110m.json";

import { cn } from "@/lib/utils";
import type { WorldEventsPayload } from "@/server/services/news";

import { FooterLink } from "../footer-link";
import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

const WIDTH = 960;
const HEIGHT = 480;

// the projection and the land never change, so they're computed once for every card
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
const path = geoPath(projection);
const atlas = countries as unknown as Topology<{ countries: GeometryCollection }>;
const LAND = path(feature(atlas, atlas.objects.countries)) ?? "";
const SPHERE = path({ type: "Sphere" }) ?? "";
const GRID = path(geoGraticule10()) ?? "";

// eonet categories, w/ a color each. anything new falls back on "other"
const CATEGORY: Record<string, { label: string; dot: string }> = {
  wildfires: { label: "Wildfire", dot: "fill-red-500 bg-red-500" },
  severeStorms: { label: "Storm", dot: "fill-sky-500 bg-sky-500" },
  volcanoes: { label: "Volcano", dot: "fill-rose-700 bg-rose-700" },
  seaLakeIce: { label: "Sea ice", dot: "fill-cyan-300 bg-cyan-300" },
  floods: { label: "Flood", dot: "fill-blue-600 bg-blue-600" },
  drought: { label: "Drought", dot: "fill-yellow-600 bg-yellow-600" },
  landslides: { label: "Landslide", dot: "fill-amber-800 bg-amber-800" },
};
const OTHER = { label: "Other", dot: "fill-zinc-400 bg-zinc-400" };
const QUAKE = "fill-orange-500 bg-orange-500";

const category = (id: string) => CATEGORY[id] ?? OTHER;

function ago(seconds: number) {
  const mins = Math.max(0, Math.round((Date.now() / 1000 - seconds) / 60));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

type Props = {
  // the "window" param, renamed here so it doesnt shadow the browser global
  range?: "day" | "week";
  minMagnitude?: number;
  showNatural?: boolean;
  // saves an in-card change to the user's widget, set on the dashboard
  onChange?: (patch: Record<string, unknown>) => void;
};

export function WorldMapCard({
  range: initialRange = "week",
  minMagnitude = 5,
  showNatural = true,
  onChange,
}: Props) {
  const [range, setRange] = useState<"day" | "week">(initialRange);
  const { data, error, loading, refresh } = useWidgetData<WorldEventsPayload>(
    "news",
    "world_events",
    { window: range, min_magnitude: minMagnitude, show_natural: showNatural },
    "",
  );

  const point = (lon: number, lat: number) => projection([lon, lat]) ?? [-100, -100];
  const legend = data && [
    { label: "Earthquake", dot: QUAKE, count: data.quakes.length },
    ...Object.values(
      data.events.reduce<Record<string, { label: string; dot: string; count: number }>>(
        (acc, e) => {
          const c = category(e.category);
          acc[c.label] = { ...c, count: (acc[c.label]?.count ?? 0) + 1 };
          return acc;
        },
        {},
      ),
    ),
  ];
  // the most recent of both, for the list under the map
  const latest = data
    ? [
        ...data.quakes.map((q) => ({
          id: q.id,
          time: q.time,
          dot: QUAKE,
          text: `M${q.mag.toFixed(1)} · ${q.place}`,
          url: q.url as string | null,
        })),
        ...data.events.map((e) => ({
          id: e.id,
          time: e.time,
          dot: category(e.category).dot,
          text: e.title,
          url: e.url,
        })),
      ]
        .sort((a, b) => b.time - a.time)
        .slice(0, 5)
    : [];

  return (
    <WidgetCard
      title="Global situation"
      monitor={{ count: data ? data.quakes.length + data.events.length : undefined }}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
      actions={
        <div className="mr-1 flex gap-1" role="group" aria-label="Time range">
          {(
            [
              ["day", "24H"],
              ["week", "7D"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setRange(value);
                onChange?.({ window: value });
              }}
              aria-pressed={range === value}
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors",
                range === value
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
      footer={
        <FooterLink href="https://earthquake.usgs.gov/earthquakes/map/">
          Open the USGS map
        </FooterLink>
      }
    >
      {data && legend && (
        <div className="space-y-3">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`World map: ${data.quakes.length} earthquakes and ${data.events.length} natural events over the last ${range === "day" ? "24 hours" : "7 days"}`}
            className="w-full"
          >
            <path d={SPHERE} className="fill-muted/60" />
            <path d={GRID} className="stroke-border fill-none" strokeWidth={0.5} />
            <path
              d={LAND}
              className="fill-muted-foreground/25 stroke-background"
              strokeWidth={0.5}
            />

            {data.events.map((e) => {
              const [x, y] = point(e.lon, e.lat);
              return (
                <circle
                  key={e.id}
                  cx={x}
                  cy={y}
                  r={4}
                  className={cn(category(e.category).dot, "stroke-background")}
                  strokeWidth={1}
                >
                  <title>{`${category(e.category).label}: ${e.title}`}</title>
                </circle>
              );
            })}

            {data.quakes.map((q) => {
              const [x, y] = point(q.lon, q.lat);
              return (
                <g key={q.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={3 + (q.mag - 4.5) * 2.5}
                    className={cn(QUAKE, "stroke-background")}
                    fillOpacity={0.8}
                    strokeWidth={1}
                  >
                    <title>{`M${q.mag.toFixed(1)}, ${q.place}`}</title>
                  </circle>
                  {/* only the big ones get a label, the map stays readable */}
                  {q.mag >= 6 && (
                    <text
                      x={x + 8}
                      y={y + 4}
                      className="fill-orange-600 font-mono text-[13px] font-semibold dark:fill-orange-400"
                    >
                      M{q.mag.toFixed(1)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs uppercase"
            aria-label="Legend"
          >
            {legend.map((l) => (
              <li key={l.label} className="text-muted-foreground flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", l.dot)} aria-hidden />
                {l.label} <span className="text-foreground">{l.count}</span>
              </li>
            ))}
          </ul>

          <ol className="divide-y text-sm" aria-label="Latest events">
            {latest.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-1.5">
                <span className="text-muted-foreground w-8 shrink-0 font-mono text-xs">
                  {ago(e.time)}
                </span>
                <span className={cn("size-2 shrink-0 rounded-full", e.dot)} aria-hidden />
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:underline"
                  >
                    {e.text}
                  </a>
                ) : (
                  <span className="truncate">{e.text}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </WidgetCard>
  );
}
