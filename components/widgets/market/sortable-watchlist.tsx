"use client";

/** the stock rows on the shared sortable list: click a row to open it, drag its grip to move it */

import { SortableList } from "@/components/sortable-list";
import type { WatchlistPayload } from "@/server/services/market/widgets/watchlist";

import { Change, HeartButton, Logo, money } from "./parts";

type Item = WatchlistPayload["items"][number];

type Props = {
  items: Item[];
  mode: WatchlistPayload["change"];
  busy: boolean;
  onOpen: (symbol: string) => void;
  onToggle: (symbol: string) => void;
  onReorder: (symbols: string[]) => void;
};

export function SortableWatchlist({ items, mode, busy, onOpen, onToggle, onReorder }: Props) {
  return (
    <SortableList
      className="max-h-72 overflow-y-auto"
      onReorder={onReorder}
      items={items.map((item) => ({
        id: item.symbol,
        label: item.symbol,
        content: (
          <>
            <button
              className="hover:bg-muted/60 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left"
              onClick={() => onOpen(item.symbol)}
            >
              <Logo src={item.logo} symbol={item.symbol} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.symbol}</span>
                <span className="text-muted-foreground block truncate text-xs">{item.name}</span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-medium tabular-nums">
                  {money(item.price, item.currency)}
                </span>
                <Change change={item.change} pct={item.changePct} mode={mode} />
                {item.stale && (
                  <span className="text-muted-foreground block text-[10px]">delayed</span>
                )}
              </span>
            </button>
            <HeartButton symbol={item.symbol} hearted busy={busy} onToggle={onToggle} />
          </>
        ),
      }))}
    />
  );
}
