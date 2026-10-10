"use client";

/** small pieces every market row uses: price, the colored change, the logo, the heart */

import { Heart } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

// ▲/▼ and the sign carry the direction, the color only repeats it, so it reads w/o color too
export function Change({
  change,
  pct,
  mode,
}: {
  change: number;
  pct: number;
  mode: "percent" | "amount";
}) {
  const up = change >= 0;
  const value = mode === "percent" ? `${Math.abs(pct).toFixed(2)}%` : Math.abs(change).toFixed(2);
  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums",
        up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
      )}
    >
      {up ? "▲" : "▼"} {up ? "+" : "-"}
      {value}
    </span>
  );
}

/** the company or coin logo, w/ its first letter underneath. the logo only shows once it has loaded,
 * so a slow or blocked cdn leaves the letter instead of an empty circle */
export function Logo({
  src,
  symbol,
  size = 28,
}: {
  src: string | null;
  symbol: string;
  size?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span
      className="bg-muted text-muted-foreground relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {symbol[0]}
      {src && (
        // from finnhub's cdn, the optimizer would only proxy a 5kb logo through our server
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          unoptimized
          onLoad={() => setLoaded(true)}
          className={cn(
            "absolute inset-0 size-full bg-white object-contain transition-opacity",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}

export function HeartButton({
  symbol,
  hearted,
  busy,
  onToggle,
}: {
  symbol: string;
  hearted: boolean;
  busy: boolean;
  onToggle: (symbol: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 shrink-0"
      aria-pressed={hearted}
      aria-label={hearted ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      disabled={busy}
      onClick={() => onToggle(symbol)}
    >
      <Heart className={cn("size-4", hearted && "fill-red-500 text-red-500")} />
    </Button>
  );
}
