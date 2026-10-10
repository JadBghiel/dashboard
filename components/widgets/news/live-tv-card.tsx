"use client";

/** live news tv: channel tabs and youtube's live stream of the picked channel. nothing loads or
 * plays until the play button is pressed, so the dashboard doesnt pull a video stream on every
 * visit. youtube-nocookie keeps youtube's tracking cookies out until then too */

import { Play } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LiveTvPayload } from "@/server/services/news";

import { FooterLink } from "../footer-link";
import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

type Props = {
  channel?: string;
  // saves an in-card change to the user's widget, set on the dashboard
  onChange?: (patch: Record<string, unknown>) => void;
};

export function LiveTvCard({ channel = "aljazeera", onChange }: Props) {
  const { data, error, loading, refresh } = useWidgetData<LiveTvPayload>(
    "news",
    "live_tv",
    { channel },
    "",
  );
  // the tab the user picked, the param's channel until then
  const [picked, setPicked] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const current = data?.channels.find((c) => c.id === (picked ?? data.selected));

  return (
    <WidgetCard
      title="Live news"
      monitor={{}}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
      footer={
        current && (
          <FooterLink href={`https://www.youtube.com/channel/${current.youtube}/live`}>
            Watch {current.name} on YouTube
          </FooterLink>
        )
      }
    >
      {data && current && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Channel">
            {data.channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setPicked(c.id);
                  onChange?.({ channel: c.id });
                }}
                aria-pressed={c.id === current.id}
                className={cn(
                  "rounded px-2 py-1 font-mono text-[11px] tracking-wider uppercase transition-colors",
                  c.id === current.id
                    ? "bg-red-600 text-white"
                    : "text-muted-foreground hover:text-foreground bg-muted",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
            {playing ? (
              <iframe
                key={current.id}
                src={`https://www.youtube-nocookie.com/embed/live_stream?channel=${current.youtube}&autoplay=1`}
                title={`${current.name} live stream`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-center">
                <div className="space-y-2">
                  <p className="flex items-center justify-center gap-1.5 font-mono text-[11px] tracking-widest text-red-500 uppercase">
                    <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
                    Ready when you are
                  </p>
                  <p className="font-mono font-semibold">{current.name}</p>
                  <Button
                    size="sm"
                    onClick={() => setPlaying(true)}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    <Play />
                    Play live feed
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
