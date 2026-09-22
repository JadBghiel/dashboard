"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";

import type { CurrentWeatherPayload } from "@/server/services/weather/widgets/current-weather";
import { describeWeather, rainUnit, tempUnit, windUnit } from "@/lib/weather-codes";

import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

type Props = {
  // empty = the user location
  city?: string;
  units?: "metric" | "imperial";
  showWind?: boolean;
  days?: number;
  locationKey: string;
};

// yyyy-mm-dd is a calendar day in the places timezone. new Date("2026-09-22") would read it as utc
// midnight and show the day before for anyone west of greenwich
function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
}

// a full forecast map on that spot, works for "your location" too since it goes by coords
const windyUrl = (lat: number, lon: number) => {
  const at = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  return `https://www.windy.com/${lat.toFixed(3)}/${lon.toFixed(3)}?${at},9`;
};

// svgs are served as is bettrer  icons this way, outline so they look good on light mode too
function WeatherIcon({ src, size, alt }: { src: string; size: number; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className="shrink-0 drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)] dark:drop-shadow-none"
    />
  );
}

export function CurrentWeatherCard({
  city = "",
  units = "metric",
  showWind = true,
  days = 5,
  locationKey,
}: Props) {
  const { data, error, loading, refresh } = useWidgetData<CurrentWeatherPayload>(
    "weather",
    "current_weather",
    { city, units, show_wind: showWind, days },
    locationKey,
  );
  const now = data && describeWeather(data.code, data.isDay);

  const stats = data && [
    { label: "Humidity", value: `${Math.round(data.humidity)}%` },
    // gone when the user turned show_wind off
    ...(data.wind !== null
      ? [{ label: "Wind", value: `${Math.round(data.wind)} ${windUnit(data.units)}` }]
      : []),
    { label: "Precipitation", value: `${data.precipitation} ${rainUnit(data.units)}` },
  ];

  return (
    <WidgetCard
      icon={<WeatherIcon src="/weather-icons/partly-cloudy-day.svg" size={20} alt="" />}
      title="Weather"
      subtitle={data?.place}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
      footer={
        data && (
          <a
            href={windyUrl(data.lat, data.lon)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            Open weather
            <ArrowRight className="size-3.5" aria-hidden />
            <span className="sr-only">(opens windy.com in a new tab)</span>
          </a>
        )
      }
    >
      {data && now && stats && (
        <div className="space-y-4" aria-live="polite">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-4xl font-semibold tracking-tight">
                {Math.round(data.temp)}
                {tempUnit(data.units)}
              </p>
              <p className="mt-1 font-medium">{now.label}</p>
              <p className="text-muted-foreground text-xs">
                Feels like {Math.round(data.feelsLike)}
                {tempUnit(data.units)}
              </p>
            </div>
            {/* the label is right next to it, so the big icon stays decorative */}
            <WeatherIcon src={now.icon} size={72} alt="" />
          </div>

          <dl
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
          >
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-muted-foreground text-xs">{s.label}</dt>
                <dd className="font-medium">{s.value}</dd>
              </div>
            ))}
          </dl>

          {data.days.length > 0 && (
            <ul
              className="grid gap-1 border-t pt-3 text-center"
              style={{ gridTemplateColumns: `repeat(${data.days.length}, minmax(0, 1fr))` }}
              aria-label="Next days"
            >
              {data.days.map((day) => {
                const w = describeWeather(day.code);
                return (
                  <li key={day.date} className="flex flex-col items-center gap-1">
                    <span className="text-muted-foreground text-xs">{weekday(day.date)}</span>
                    <WeatherIcon src={w.icon} size={32} alt={w.label} />
                    <span className="text-xs tabular-nums">
                      <span className="font-medium">{Math.round(day.max)}°</span>
                      <span className="text-muted-foreground"> / {Math.round(day.min)}°</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
