"use client";

/** the extended view of 1 ticker: its quote, fetched when you open it, and the view that shows it */

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

import { Change, HeartButton, Logo, money } from "./parts";

type Detail = {
  symbol: string;
  name: string;
  logo: string | null;
  exchange: string | null;
  currency: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  stale: boolean;
  googleUrl: string;
};

type QuoteState = { symbol: string | null; data: Detail | null; error: string | null };

async function fetchQuote(symbol: string, signal: AbortSignal) {
  try {
    const res = await api.market.quote[":symbol"].$get({ param: { symbol } }, { init: { signal } });
    const body = await res.json();
    return "price" in body ? { data: body, error: null } : { data: null, error: body.message };
  } catch {
    return { data: null, error: "Could not reach the server." };
  }
}

/** the extended view data. like useWidgetData, loading is derived: the data isnt for this symbol yet */
export function useQuote(symbol: string | null) {
  const [state, setState] = useState<QuoteState>({ symbol: null, data: null, error: null });

  useEffect(() => {
    if (!symbol) return;
    const ctrl = new AbortController();
    fetchQuote(symbol, ctrl.signal).then((next) => {
      if (!ctrl.signal.aborted) setState({ symbol, ...next });
    });
    return () => ctrl.abort();
  }, [symbol]);

  const current = state.symbol === symbol;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current,
  };
}

type Props = {
  symbol: string;
  detail: ReturnType<typeof useQuote>;
  hearted: boolean;
  busy: boolean;
  onToggle: (symbol: string) => void;
  onBack: () => void;
};

export function DetailView({ symbol, detail, hearted, busy, onToggle, onBack }: Props) {
  const d = detail.data;
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft /> Back
      </Button>

      {detail.error && (
        <p role="alert" className="text-destructive text-sm">
          {detail.error}
        </p>
      )}
      {detail.loading && (
        <div className="space-y-3" aria-hidden>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-28" />
        </div>
      )}

      {d && (
        <div className="space-y-4" aria-live="polite">
          <div className="flex items-center gap-3">
            <Logo src={d.logo} symbol={d.symbol} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{d.name}</p>
              <p className="text-muted-foreground text-xs">
                {d.symbol}
                {d.exchange && ` · ${d.exchange}`}
              </p>
            </div>
            <HeartButton symbol={symbol} hearted={hearted} busy={busy} onToggle={onToggle} />
          </div>

          <div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {money(d.price, d.currency)}
            </p>
            <div className="flex items-center gap-2">
              <Change change={d.change} pct={d.changePct} mode="amount" />
              <Change change={d.change} pct={d.changePct} mode="percent" />
              {d.stale && <span className="text-muted-foreground text-xs">delayed</span>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              ["Open", d.open],
              ["Prev close", d.prevClose],
              ["Day high", d.high],
              ["Day low", d.low],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums">{money(value as number, d.currency)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
