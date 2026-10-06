"use client";

/** market widget: watchlist tab w/ live prices, a search tab to find tickers, and an extended
 * view of 1 ticker. hearting saves to an httpOnly cookie through /api/market/watchlist. the search
 * tab is in stock-search.tsx and the extended view in stock-detail.tsx */

import { ArrowRight, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { WatchlistPayload } from "@/server/services/market/widgets/watchlist";

import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

import { SortableWatchlist } from "./sortable-watchlist";
import { DetailView, useQuote } from "./stock-detail";
import { SearchPanel } from "./stock-search";

const GOOGLE_FINANCE = "https://www.google.com/finance/";

export function StockCard() {
  // null until the cookie watchlist is known
  const [saved, setSaved] = useState<string[] | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // tickers "" = the hearted ones, the server reads them from the cookie
  const { data, error, loading, refresh } = useWidgetData<WatchlistPayload>(
    "market",
    "stock_watchlist",
    { tickers: "", change: "percent" },
    // sorted: a heart or an unheart refetches, a drag only reorders what's already on screen
    saved ? [...saved].sort().join(",") : "",
  );

  useEffect(() => {
    api.market.watchlist
      .$get()
      .then((res) => res.json())
      .then((body) => {
        setSaved(body.symbols);
        // the default tab is picked once, on load. recomputing it would jump to the watchlist the
        // moment you heart your 1st ticker, mid search
        setTab((t) => t ?? (body.symbols.length > 0 ? "watchlist" : "search"));
      })
      .catch(() => setSaved([]));
  }, []);

  async function toggle(symbol: string) {
    setBusy(true);
    setMessage(null);
    const res = saved?.includes(symbol)
      ? await api.market.watchlist[":symbol"].$delete({ param: { symbol } })
      : await api.market.watchlist.$post({ json: { symbol } });
    const body = await res.json();
    setBusy(false);
    if ("symbols" in body) setSaved(body.symbols);
    else setMessage(body.message);
  }

  // optimistic: the rows move at once, and go back if the server refuses
  async function reorder(next: string[]) {
    const previous = saved;
    setSaved(next);
    setMessage(null);
    const res = await api.market.watchlist.$put({ json: { symbols: next } });
    if (!res.ok) {
      setSaved(previous);
      setMessage("Couldn't save the new order.");
    }
  }

  // the payload comes in the cookie order of the last fetch, saved holds the order right now
  const bySymbol = new Map(data?.items.map((i) => [i.symbol, i]));
  const ordered = saved
    ? saved.flatMap((s) => (bySymbol.has(s) ? [bySymbol.get(s)!] : []))
    : (data?.items ?? []);

  const detail = useQuote(open);
  const activeTab = tab ?? "search";

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
          hearted={!!saved?.includes(open)}
          busy={busy}
          onToggle={toggle}
          onBack={() => setOpen(null)}
        />
      ) : (
        data && (
          <Tabs value={activeTab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="watchlist">Watchlist ({saved?.length ?? 0})</TabsTrigger>
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
                  busy={busy}
                  onOpen={setOpen}
                  onToggle={toggle}
                  onReorder={reorder}
                />
              )}
            </TabsContent>

            <TabsContent value="search">
              <SearchPanel saved={saved ?? []} busy={busy} onToggle={toggle} onOpen={setOpen} />
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
