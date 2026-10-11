"use client";

/** the news options in the settings window: topics as chips, keywords as tags, country and
 * language from short lists */

import { X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NEWS_LANGUAGES as LANGUAGES, NEWS_TOPICS as TOPICS } from "@/lib/news-prefs";
import { cn } from "@/lib/utils";

// google's biggest editions, the ones worth offering in a short list
// prettier-ignore
const COUNTRIES = ["US", "GB", "CA", "AU", "IN", "IE", "FR", "BE", "CH", "DE", "AT", "ES", "MX", "AR",
  "IT", "PT", "BR", "NL", "JP", "KR"];

export const regionName = (code: string) =>
  new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
export const languageName = (code: string) =>
  new Intl.DisplayNames(undefined, { type: "language" }).of(code) ?? code;

const csv = (v: unknown) => (typeof v === "string" ? v.split(",").filter(Boolean) : []);

/** the news options in the settings window: topics as chips, keywords as tags, country and
 * language from short lists. null clears an option back to automatic */
export function NewsSettings({
  params,
  onChange,
}: {
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const topics = csv(params.topics);
  const keywords = csv(params.keywords);
  const [keyword, setKeyword] = useState("");

  function toggleTopic(t: string) {
    const next = topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t];
    onChange({ topics: next.join(",") });
  }

  function addKeyword() {
    const k = keyword.trim().toLowerCase();
    if (k.length < 2 || keywords.length >= 5 || keywords.includes(k) || k.includes(",")) return;
    onChange({ keywords: [...keywords, k].join(",") });
    setKeyword("");
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Topics</Label>
        <p className="text-muted-foreground mb-2 text-xs">None picked = the top stories</p>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map((t) => {
            const on = topics.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTopic(t)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
                  on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="news-keyword">Keywords</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="news-keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value.slice(0, 40))}
            // its own enter, the settings form around it would submit otherwise
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addKeyword();
            }}
            placeholder="Formula 1, Real Madrid..."
            disabled={keywords.length >= 5}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addKeyword}
            disabled={keywords.length >= 5}
          >
            Add
          </Button>
        </div>
        {keywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {keywords.map((k) => (
              <Badge key={k} variant="secondary" className="gap-1 pr-1">
                {k}
                <button
                  type="button"
                  onClick={() => onChange({ keywords: keywords.filter((x) => x !== k).join(",") })}
                  aria-label={`Remove ${k}`}
                  className="hover:bg-muted rounded-full p-0.5"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="news-country">Country</Label>
          <Select
            value={typeof params.country === "string" && params.country ? params.country : "auto"}
            onValueChange={(v) => onChange({ country: v === "auto" ? "" : v })}
          >
            <SelectTrigger id="news-country" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Where I am</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {regionName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="news-language">Language</Label>
          <Select
            value={typeof params.language === "string" ? params.language : "auto"}
            onValueChange={(v) => onChange({ language: v === "auto" ? null : v })}
          >
            <SelectTrigger id="news-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Local</SelectItem>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>
                  {languageName(l)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
