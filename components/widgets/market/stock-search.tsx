"use client";

/** the search tab of the stock card: find a us ticker, open it or tap its heart */

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

import { HeartButton } from "./parts";

type Match = { symbol: string; name: string };

type Props = {
  saved: string[];
  busy: boolean;
  onToggle: (symbol: string) => void;
  onOpen: (symbol: string) => void;
};

export function SearchPanel({ saved, busy, onToggle, onOpen }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // debounced so typing "nvidia" is 1 search, not 6, the finnhub key is shared by everyone
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.market.search.$get(
          { query: { q } },
          { init: { signal: ctrl.signal } },
        );
        const body = await res.json();
        if ("results" in body) {
          setResults(body.results);
          setMessage(body.results.length === 0 ? "No US ticker matches that." : null);
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
          placeholder="Search a company or ticker"
          aria-label="Search a company or ticker"
          className="pl-8"
        />
      </div>
      {results.length > 0 && (
        <ul className="max-h-64 divide-y overflow-y-auto" aria-label="Matching tickers">
          {results.map((r) => (
            <li key={r.symbol} className="flex items-center gap-2 py-1.5">
              <button
                className="hover:bg-muted/60 -mx-1 min-w-0 flex-1 rounded-md px-1 py-0.5 text-left"
                onClick={() => onOpen(r.symbol)}
              >
                <span className="block text-sm font-semibold">{r.symbol}</span>
                <span className="text-muted-foreground block truncate text-xs">{r.name}</span>
              </button>
              <HeartButton
                symbol={r.symbol}
                hearted={saved.includes(r.symbol)}
                busy={busy}
                onToggle={onToggle}
              />
            </li>
          ))}
        </ul>
      )}
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}
