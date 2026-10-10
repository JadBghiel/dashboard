"use client";

/** spelling bee: 7 letters around a center one, click them or type. the center letter must be in
 * every word, a word using all 7 (the pangram) is worth 7 more points */

import { Delete, Hexagon, Shuffle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import { FooterLink } from "../footer-link";
import { WidgetCard } from "../widget-card";

import { useGame } from "./use-game";

type BeeState = {
  number: number;
  center: string;
  letters: string[];
  minLength: number;
  found: { word: string; points: number; pangram: boolean }[];
  score: number;
  rank: string;
};

// the 6 outer cells around the center one, as grid positions
const RING = [
  "col-start-2 row-start-1",
  "col-start-3 row-start-2",
  "col-start-3 row-start-3",
  "col-start-2 row-start-4",
  "col-start-1 row-start-3",
  "col-start-1 row-start-2",
];

export function BeeCard({ minLength = 4 }: { minLength?: number }) {
  const query = { min_length: String(minLength) };
  const { game, error, loading, busy, message, setMessage, play, refresh } = useGame<BeeState>(
    (signal) => api.games.bee.$get({ query }, { init: { signal } }),
    String(minLength),
  );
  const [word, setWord] = useState("");
  // a shuffle only reorders the outer letters on screen, the puzzle doesnt change
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3, 4, 5]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!word.trim() || busy) return;
    const ok = await play(() => api.games.bee.$post({ query, json: { word } }));
    if (ok) setWord("");
  }

  const letter = (l: string, center = false, className = "") => (
    <button
      key={l}
      type="button"
      onClick={() => {
        setMessage(null);
        setWord((w) => (w + l).slice(0, 15));
      }}
      aria-label={`${l}${center ? ", center letter" : ""}`}
      className={cn(
        "flex size-11 items-center justify-center text-lg font-bold uppercase transition-transform active:scale-95",
        "[clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0%_50%)]",
        center ? "bg-amber-400 text-black" : "bg-secondary hover:bg-muted",
        className,
      )}
    >
      {l}
    </button>
  );

  return (
    <WidgetCard
      icon={<Hexagon className="size-5 text-amber-500" aria-hidden />}
      title="Spelling Bee"
      subtitle={game ? `#${game.number} · ${game.score} pts · ${game.rank}` : undefined}
      loading={loading}
      error={error}
      hasData={!!game}
      onRefresh={refresh}
      footer={
        <FooterLink href="https://www.nytimes.com/puzzles/spelling-bee">
          Play the original
        </FooterLink>
      }
    >
      {game && (
        <div className="space-y-3">
          <div className="mx-auto grid w-fit grid-cols-3 grid-rows-4 gap-x-1 [&>*]:-my-1.5">
            {order.map((i, pos) => letter(game.letters[i], false, RING[pos]))}
            {letter(game.center, true, "col-start-2 row-start-2 row-span-2 self-center")}
          </div>

          <form onSubmit={submit} className="flex gap-1">
            <Input
              value={word}
              onChange={(e) => {
                setMessage(null);
                setWord(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z]/g, "")
                    .slice(0, 15),
                );
              }}
              placeholder="Word"
              aria-label="Your word"
              className="font-semibold tracking-wider uppercase"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setWord((w) => w.slice(0, -1))}
              aria-label="Delete a letter"
            >
              <Delete />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOrder((o) => [...o].sort(() => Math.random() - 0.5))}
              aria-label="Shuffle the letters"
            >
              <Shuffle />
            </Button>
            <Button type="submit" disabled={busy || !word}>
              Enter
            </Button>
          </form>

          {message && (
            <p role="alert" className="text-destructive text-center text-sm">
              {message}
            </p>
          )}

          <div>
            <p className="text-muted-foreground mb-1 text-xs">
              {game.minLength}+ letters, always w/ {game.center.toUpperCase()} · {game.found.length}{" "}
              word{game.found.length === 1 ? "" : "s"} found
            </p>
            <ul className="flex flex-wrap gap-1" aria-live="polite" aria-label="Words found">
              {game.found.map((f) => (
                <li
                  key={f.word}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    f.pangram ? "bg-amber-400 text-black" : "bg-muted",
                  )}
                >
                  {f.word}
                  {f.pangram && <span className="sr-only"> (uses all 7 letters)</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
