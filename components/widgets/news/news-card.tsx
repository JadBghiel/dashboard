"use client";

/** the 1 news widget. what it shows comes from the widget's options (topics, keywords, country,
 * language, count), saved to the user's widget through the settings window */

import Image from "next/image";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HeadlinesPayload } from "@/server/services/news";

import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

import { languageName, regionName } from "./news-settings";

// short on purpose, it sits in a narrow monospace column: 35m, 2h, 1d
function timeAgo(seconds: number) {
  const mins = Math.round((Date.now() / 1000 - seconds) / 60);
  if (!seconds || mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

type Article = HeadlinesPayload["items"][number];

// the feed has no article images, so the publisher's logo stands in. alt is empty, its name is
// written right next to it
function SourceLogo({ domain }: { domain: string | null }) {
  if (!domain) return null;
  return (
    <Image
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      width={14}
      height={14}
      unoptimized
      className="shrink-0 rounded-sm"
    />
  );
}

// 1 dense feed row: the age in a monospace column, the headline, then who published it
function Row({ article: a, showTag }: { article: Article; showTag: boolean }) {
  return (
    <li className="hover:bg-muted/50 grid grid-cols-[2.5rem_1fr] gap-2 rounded-md px-1 py-2">
      <span className="text-muted-foreground pt-0.5 font-mono text-xs">
        {timeAgo(a.publishedAt)}
      </span>
      <div className="min-w-0">
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm leading-snug font-medium hover:underline"
        >
          {a.title}
        </a>
        <span className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
          <SourceLogo domain={a.domain} />
          <span className="truncate">{a.source ?? "Unknown source"}</span>
          {a.coverage > 0 && (
            <span className="shrink-0 font-mono" title={`${a.coverage} more outlets cover this`}>
              +{a.coverage}
            </span>
          )}
          {showTag && (
            <Badge variant="secondary" className="ml-auto shrink-0 font-mono text-[10px] uppercase">
              {a.from}
            </Badge>
          )}
        </span>
      </div>
    </li>
  );
}

type Props = {
  // comma lists, empty topics = the top stories
  topics?: string;
  keywords?: string;
  // 2 letters, empty = the user's country
  country?: string;
  language?: string;
  count?: number;
  locationKey: string;
};

export function NewsCard({
  topics = "",
  keywords = "",
  country = "",
  language,
  count,
  locationKey,
}: Props) {
  // which feed is shown: all of them, or 1 topic or keyword
  const [tab, setTab] = useState("all");

  const { data, error, loading, refresh } = useWidgetData<HeadlinesPayload>(
    "news",
    "headlines",
    { topics, keywords, country, ...(language && { language }), ...(count && { count }) },
    locationKey,
  );

  const feeds = data ? [...new Set(data.items.map((a) => a.from))] : [];
  // a tab from before a settings change may not exist anymore
  const active = feeds.includes(tab) ? tab : "all";
  const items = data?.items.filter((a) => active === "all" || a.from === active) ?? [];

  return (
    <WidgetCard
      title="Headlines"
      monitor={{ count: data ? items.length : undefined }}
      subtitle={data ? `${regionName(data.country)} · ${languageName(data.language)}` : undefined}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
    >
      {data &&
        (data.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No headlines for these settings.</p>
        ) : (
          <div className="space-y-2">
            {feeds.length > 1 && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Show">
                {["all", ...feeds].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTab(f)}
                    aria-pressed={active === f}
                    className={cn(
                      "rounded px-2 py-1 font-mono text-[11px] tracking-wider uppercase transition-colors",
                      active === f
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground bg-muted",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            {/* 2 columns once the card is wide enough, the rows stay dense */}
            <ul className="grid gap-x-6 md:grid-cols-2" aria-live="polite">
              {items.map((a) => (
                <Row key={a.url} article={a} showTag={active === "all" && feeds.length > 1} />
              ))}
            </ul>
          </div>
        ))}
    </WidgetCard>
  );
}
