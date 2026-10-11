"use client";

/** the crypto widget: hearted coins w/ live prices (drag to reorder), and a search tab to add
 * more. the list lives in an httpOnly cookie through /api/market/crypto-watchlist */

import { ArrowRight, Bitcoin, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { SortableList } from "@/components/sortable-list";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { CRYPTO_MAX } from "@/server/crypto-watchlist";
import type { CryptoPayload } from "@/server/services/market/widgets/crypto";

import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

import { Change, HeartButton, Logo, money } from "./parts";

type Match = { id: string; name: string; symbol: string; image: string | null };

type Props = {
  // coingecko ids, comma list, the hearted coins in the user's order
  coins?: string;
  currency?: "usd" | "eur" | "gbp";
  // saves the hearted list to the user's widget, set on the dashboard
  onChange?: (patch: Record<string, unknown>) => void;
};

// same cap as the server param, 15 coins is already a long card

export function CryptoCard({ coins = "", currency = "usd", onChange }: Props) {
  const [saved, setSaved] = useState(() => coins.split(",").filter(Boolean));
  const [tab, setTab] = useState<string>("watchlist");
  const [message, setMessage] = useState<string | null>(null);

  // sorted in the params: a heart refetches, a drag only reorders what's already on screen
  const { data, error, loading, refresh } = useWidgetData<CryptoPayload>(
    "currencies",
    "crypto_prices",
    { coins: [...saved].sort().join(","), currency },
    "",
  );

  function save(next: string[]) {
    setSaved(next);
    onChange?.({ coins: next.join(",") });
  }

  function toggle(id: string) {
    setMessage(null);
    if (saved.includes(id)) return save(saved.filter((c) => c !== id));
    if (saved.length >= CRYPTO_MAX) return setMessage(`${CRYPTO_MAX} coins at most.`);
    save([...saved, id]);
  }

  const byId = new Map(data?.items.map((c) => [c.id, c]));
  const ordered = saved.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));

  return (
    <WidgetCard
      icon={<Bitcoin className="size-5 text-amber-500" aria-hidden />}
      title="Crypto"
      subtitle={data?.stale ? "Last known prices, CoinGecko is busy" : "Prices over the last 24h"}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
      footer={
        <a
          href="https://www.coingecko.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          Open CoinGecko
          <ArrowRight className="size-3.5" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      }
    >
      {data && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="watchlist">My coins ({saved.length})</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="watchlist">
            {ordered.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No coins yet.{" "}
                <button
                  className="text-foreground underline underline-offset-4"
                  onClick={() => setTab("search")}
                >
                  Search one
                </button>{" "}
                and tap the heart.
              </p>
            ) : (
              <SortableList
                className="max-h-80 overflow-y-auto"
                onReorder={save}
                items={ordered.map((coin) => ({
                  id: coin.id,
                  label: coin.symbol,
                  content: (
                    <>
                      <Logo src={coin.image} symbol={coin.symbol} />
                      <span className="min-w-0 flex-1 pl-1">
                        <span className="block text-sm font-semibold">{coin.symbol}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {coin.name}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-medium tabular-nums">
                          {money(coin.price, data.currency.toUpperCase())}
                        </span>
                        <Change change={coin.changePct} pct={coin.changePct} mode="percent" />
                      </span>
                      <HeartButton
                        symbol={coin.symbol}
                        hearted
                        busy={false}
                        onToggle={() => toggle(coin.id)}
                      />
                    </>
                  ),
                }))}
              />
            )}
          </TabsContent>

          <TabsContent value="search">
            <CoinSearch saved={saved} busy={false} onToggle={toggle} />
          </TabsContent>
        </Tabs>
      )}
      {message && (
        <p role="alert" className="text-destructive text-sm">
          {message}
        </p>
      )}
    </WidgetCard>
  );
}

function CoinSearch({
  saved,
  busy,
  onToggle,
}: {
  saved: string[];
  busy: boolean;
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // debounced, coingecko's keyless tier is shared by everyone
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.market["crypto-search"].$get(
          { query: { q } },
          { init: { signal: ctrl.signal } },
        );
        const body = await res.json();
        if ("results" in body) {
          setResults(body.results);
          setMessage(body.results.length === 0 ? "No coin matches that." : null);
        } else setMessage(body.message);
      } catch {
        // aborted by the next keystroke
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) {
              setResults([]);
              setMessage(null);
            }
          }}
          placeholder="Search a coin"
          aria-label="Search a coin"
          className="pl-8"
        />
      </div>
      {results.length > 0 && (
        <ul className="max-h-64 divide-y overflow-y-auto" aria-label="Matching coins">
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-1.5">
              <Logo src={r.image} symbol={r.symbol} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{r.symbol}</span>
                <span className="text-muted-foreground block truncate text-xs">{r.name}</span>
              </span>
              <HeartButton
                symbol={r.symbol}
                hearted={saved.includes(r.id)}
                busy={busy}
                onToggle={() => onToggle(r.id)}
              />
            </li>
          ))}
        </ul>
      )}
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}
