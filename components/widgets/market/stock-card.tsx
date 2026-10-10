"use client";

/** market widget: watchlist tab w/ live prices, a search tab to find tickers, and an extended
 * view of 1 ticker. hearting saves to an httpOnly cookie through /api/market/watchlist. the search
 * tab is in stock-search.tsx and the extended view in stock-detail.tsx */

import { ArrowRight, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WATCHLIST_MAX } from "@/server/market-watchlist";
import type { WatchlistPayload } from "@/server/services/market/widgets/watchlist";

import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

import { SortableWatchlist } from "./sortable-watchlist";
import { DetailView, useQuote } from "./stock-detail";
import { SearchPanel } from "./stock-search";

const GOOGLE_FINANCE = "https://www.google.com/finance/";

type Props = {
  // comma list, the hearted tickers in the user's order
  tickers?: string;
  change?: "percent" | "amount";
  // saves the hearted list to the user's widget, set on the dashboard
  onChange?: (patch: Record<string, unknown>) => void;
};

const list = (csv: string) => csv.split(",").filter(Boolean);

export function StockCard({ tickers = "", change = "percent", onChange }: Props) {
  const [saved, setSaved] = useState(() => list(tickers));
  // picked once, on load: recomputing it would jump to the watchlist the moment you heart your
  // 1st ticker, mid search
  const [tab, setTab] = useState(() => (list(tickers).length > 0 ? "watchlist" : "search"));
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data, error, loading, refresh } = useWidgetData<WatchlistPayload>(
    "market",
    "stock_watchlist",
    // sorted: a heart or an unheart refetches, a drag only reorders what's already on screen
    { tickers: [...saved].sort().join(","), change },
    "",
  );

  function save(next: string[]) {
    setSaved(next);
    onChange?.({ tickers: next.join(",") });
  }

  function toggle(symbol: string) {
    setMessage(null);
    if (saved.includes(symbol)) return save(saved.filter((s) => s !== symbol));
    if (saved.length >= WATCHLIST_MAX) {
      return setMessage(`Your watchlist is full, ${WATCHLIST_MAX} tickers at most.`);
    }
    save([...saved, symbol]);
  }

  // the payload comes sorted, saved holds the user's order
  const bySymbol = new Map(data?.items.map((i) => [i.symbol, i]));
  const ordered = saved.flatMap((s) => (bySymbol.has(s) ? [bySymbol.get(s)!] : []));

  const detail = useQuote(open);
  const activeTab = tab;

  return (
    <WidgetCard
      icon={<TrendingUp className="size-5 text-emerald-500" aria-hidden />}
      title="Stock market"
      subtitle={open ? undefined : "Prices from the US markets"}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
      footer={
        <a
          href={open && detail.data ? detail.data.googleUrl : GOOGLE_FINANCE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          Open stock market
          <ArrowRight className="size-3.5" aria-hidden />
          <span className="sr-only">(opens Google Finance in a new tab)</span>
        </a>
      }
    >
      {open ? (
        <DetailView
          symbol={open}
          detail={detail}
          hearted={saved.includes(open)}
          busy={false}
          onToggle={toggle}
          onBack={() => setOpen(null)}
        />
      ) : (
        data && (
          <Tabs value={activeTab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="watchlist">Watchlist ({saved.length})</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
            </TabsList>

            <TabsContent value="watchlist">
              {data.items.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No tickers yet.{" "}
                  <button
                    className="text-foreground underline underline-offset-4"
                    onClick={() => setTab("search")}
                  >
                    Search one
                  </button>{" "}
                  and tap the heart.
                </p>
              ) : (
                <SortableWatchlist
                  items={ordered}
                  mode={data.change}
                  busy={false}
                  onOpen={setOpen}
                  onToggle={toggle}
                  onReorder={save}
                />
              )}
            </TabsContent>

            <TabsContent value="search">
              <SearchPanel saved={saved} busy={false} onToggle={toggle} onOpen={setOpen} />
            </TabsContent>
          </Tabs>
        )
      )}
      {message && (
        <p role="alert" className="text-destructive text-sm">
          {message}
        </p>
      )}
    </WidgetCard>
  );
}
