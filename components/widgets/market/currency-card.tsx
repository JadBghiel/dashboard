"use client";

/** the rates are fetched once per base currency, the amount is multiplied heree */

import { ArrowRightLeft, Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrencyPayload } from "@/server/services/market/widgets/currency";

import { useWidgetData } from "../use-widget-data";
import { FooterLink } from "../footer-link";
import { WidgetCard } from "../widget-card";

import { money } from "./parts";

type Props = { from?: string; to?: string; amount?: number };

export function CurrencyCard({ from = "EUR", to = "USD,GBP,JPY", amount = 100 }: Props) {
  const [base, setBase] = useState(from);
  const [targets, setTargets] = useState(to.split(","));
  const [value, setValue] = useState(String(amount));

  const { data, error, loading, refresh } = useWidgetData<CurrencyPayload>(
    "market",
    "currency_converter",
    { from: base, to: targets.join(","), amount },
    "",
  );

  const typed = Number(value.replace(",", "."));
  const qty = Number.isFinite(typed) && typed >= 0 ? typed : 0;
  const addable = data?.currencies.filter((c) => c !== base && !targets.includes(c)) ?? [];

  // the 1st target becomes the base and the old base takes its place in the list
  function swap() {
    const [first, ...rest] = targets;
    if (!first) return;
    setTargets([base, ...rest]);
    setBase(first);
  }

  return (
    <WidgetCard
      icon={<ArrowRightLeft className="size-5 text-sky-500" aria-hidden />}
      title="Currency converter"
      subtitle={data ? `ECB rates of ${data.date}` : undefined}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
      footer={
        // xe opens on the same conversion the card shows
        <FooterLink
          href={`https://www.xe.com/currencyconverter/convert/?Amount=${qty || 1}&From=${base}&To=${targets[0] ?? "USD"}`}
        >
          Open currency converter
        </FooterLink>
      }
    >
      {data && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Amount"
              className="tabular-nums"
            />
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger aria-label="From currency" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={swap} aria-label="Swap currencies">
              <ArrowRightLeft />
            </Button>
          </div>

          <ul className="divide-y" aria-live="polite">
            {data.rates.map((r) => (
              <li key={r.currency} className="flex items-center gap-2 py-2">
                <span className="w-10 text-sm font-semibold">{r.currency}</span>
                <span className="flex-1 text-right text-sm font-medium tabular-nums">
                  {money(qty * r.rate, r.currency)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setTargets((t) => t.filter((c) => c !== r.currency))}
                  disabled={targets.length === 1}
                  aria-label={`Remove ${r.currency}`}
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>

          {addable.length > 0 && targets.length < 8 && (
            <Select value="" onValueChange={(c) => setTargets((t) => [...t, c])}>
              <SelectTrigger size="sm" aria-label="Add a currency" className="w-full">
                <Plus className="size-3.5" aria-hidden />
                <SelectValue placeholder="Add a currency" />
              </SelectTrigger>
              <SelectContent>
                {addable.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
