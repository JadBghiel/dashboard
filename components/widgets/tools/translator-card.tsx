"use client";

/** translates as you type, debounced so a sentence is 1 call, not 1 per key. the free service
 * counts characters per day, so the text is capped at 500 */

import { ArrowLeftRight, Check, Copy, Languages, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { TranslatorPayload } from "@/server/services/tools/widgets";

import { useWidgetData } from "../use-widget-data";
import { FooterLink } from "../footer-link";
import { WidgetCard } from "../widget-card";

const MAX = 500;
type Lang = "en" | "fr" | "es" | "de" | "it" | "pt" | "nl" | "ar" | "zh" | "ja" | "ko" | "ru";
type Result = { key: string; text: string | null; error: string | null };

export function TranslatorCard({
  from = "en",
  to = "fr",
  onChange,
}: {
  from?: Lang;
  to?: Lang;
  // saves an in-card change to the user's widget, set on the dashboard
  onChange?: (patch: Record<string, unknown>) => void;
}) {
  const { data, error, loading, refresh } = useWidgetData<TranslatorPayload>(
    "tools",
    "translator",
    { from, to },
    "",
  );
  const [src, setSrc] = useState<Lang>(from);
  const [dst, setDst] = useState<Lang>(to);
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result>({ key: "", text: null, error: null });
  const [copied, setCopied] = useState(false);

  const input = text.trim();
  const key = `${src}|${dst}|${input}`;
  const translating = input !== "" && result.key !== key;

  useEffect(() => {
    if (!input) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.tools.translate.$post(
          { json: { text: input, from: src, to: dst } },
          { init: { signal: ctrl.signal } },
        );
        const body = await res.json();
        setResult(
          "text" in body
            ? { key, text: body.text, error: null }
            : { key, text: null, error: body.message },
        );
      } catch {
        // aborted by the next keystroke
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [input, src, dst, key]);

  function swap() {
    setSrc(dst);
    setDst(src);
    if (result.text) setText(result.text);
    onChange?.({ from: dst, to: src });
  }

  async function copy() {
    if (!result.text) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const picker = (value: Lang, onChange: (l: Lang) => void, label: string) => (
    <Select value={value} onValueChange={(v) => onChange(v as Lang)}>
      <SelectTrigger aria-label={label} className="flex-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {data?.languages.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const shown = input && result.key === key ? result : null;

  return (
    <WidgetCard
      icon={<Languages className="size-5 text-violet-500" aria-hidden />}
      title="Translator"
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
      footer={
        // google translate opens on the same languages and text
        <FooterLink
          href={`https://translate.google.com/?sl=${src}&tl=${dst}&text=${encodeURIComponent(input)}&op=translate`}
        >
          Open Google Translate
        </FooterLink>
      }
    >
      {data && (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            {picker(
              src,
              (l) => {
                setSrc(l);
                onChange?.({ from: l });
              },
              "Translate from",
            )}
            <Button variant="ghost" size="icon" onClick={swap} aria-label="Swap languages">
              <ArrowLeftRight />
            </Button>
            {picker(
              dst,
              (l) => {
                setDst(l);
                onChange?.({ to: l });
              },
              "Translate to",
            )}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            placeholder="Type something to translate"
            aria-label="Text to translate"
            rows={3}
          />
          <p className="text-muted-foreground text-right text-[10px] tabular-nums">
            {text.length}/{MAX}
          </p>
          <div
            className="bg-muted/50 relative min-h-16 rounded-lg p-3 pr-10 text-sm"
            aria-live="polite"
          >
            {translating && (
              <LoaderCircle
                className="text-muted-foreground size-4 animate-spin"
                aria-label="Translating"
              />
            )}
            {shown?.text}
            {shown?.error && <span className="text-destructive">{shown.error}</span>}
            {!input && <span className="text-muted-foreground">The translation shows up here</span>}
            {shown?.text && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 size-7"
                onClick={copy}
                aria-label="Copy the translation"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
