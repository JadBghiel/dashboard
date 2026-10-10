"use client";

/** wordle: type on the physical keyboard (once the card has focus) or on the one below. every tile
 * says its state in words for screen readers, the color only repeats it */

import { CaseSensitive, Delete } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import { FooterLink } from "../footer-link";
import { WidgetCard } from "../widget-card";

import { useGame } from "./use-game";

type Mark = "correct" | "present" | "absent";
type WordleState = {
  number: number;
  length: number;
  hard: boolean;
  maxGuesses: number;
  rows: { word: string; marks: Mark[] }[];
  status: "playing" | "won" | "lost";
  answer: string | null;
};

const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

const TILE: Record<Mark, string> = {
  correct: "bg-emerald-600 border-emerald-600 text-white",
  present: "bg-amber-500 border-amber-500 text-white",
  absent: "bg-zinc-500 border-zinc-500 text-white dark:bg-zinc-700 dark:border-zinc-700",
};
const LABEL: Record<Mark, string> = {
  correct: "right spot",
  present: "wrong spot",
  absent: "not in the word",
};
// a key keeps its best known state: green beats yellow beats grey
const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

type Props = { length?: number; hardMode?: boolean };

export function WordleCard({ length = 5, hardMode = false }: Props) {
  const query = { length: String(length), hard: String(hardMode) as "true" | "false" };
  const { game, error, loading, busy, message, setMessage, play, refresh } = useGame<WordleState>(
    (signal) => api.games.wordle.$get({ query }, { init: { signal } }),
    `${length}|${hardMode}`,
  );
  const [typed, setTyped] = useState("");

  const keyState: Record<string, Mark> = {};
  for (const row of game?.rows ?? []) {
    [...row.word].forEach((l, i) => {
      const m = row.marks[i];
      if (!keyState[l] || RANK[m] > RANK[keyState[l]]) keyState[l] = m;
    });
  }

  async function submit() {
    if (!game || busy) return;
    if (typed.length !== game.length) return setMessage(`A guess is ${game.length} letters.`);
    const ok = await play(() => api.games.wordle.$post({ query, json: { guess: typed } }));
    if (ok) setTyped("");
  }

  function press(key: string) {
    if (!game || game.status !== "playing") return;
    if (key === "enter") return submit();
    setMessage(null);
    if (key === "back") return setTyped((t) => t.slice(0, -1));
    if (/^[a-z]$/.test(key) && typed.length < game.length) setTyped((t) => t + key);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "enter" || k === "backspace" || /^[a-z]$/.test(k)) {
      e.preventDefault();
      press(k === "backspace" ? "back" : k);
    }
  }

  const rows = game
    ? Array.from({ length: game.maxGuesses }, (_, i) => {
        const done = game.rows[i];
        if (done) return { letters: [...done.word], marks: done.marks as (Mark | null)[] };
        const current = i === game.rows.length && game.status === "playing";
        return {
          letters: [...(current ? typed : "").padEnd(game.length, " ")],
          marks: Array<Mark | null>(game.length).fill(null),
        };
      })
    : [];

  return (
    <WidgetCard
      icon={<CaseSensitive className="size-5 text-emerald-500" aria-hidden />}
      title="Wordle"
      subtitle={game ? `#${game.number}${game.hard ? " · hard mode" : ""}` : undefined}
      loading={loading}
      error={error}
      hasData={!!game}
      onRefresh={refresh}
      footer={
        <FooterLink href="https://www.nytimes.com/games/wordle/index.html">
          Play the original
        </FooterLink>
      }
    >
      {game && (
        <div
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="focus-visible:ring-ring/50 space-y-3 rounded-lg outline-none focus-visible:ring-3"
          aria-label="Wordle board, type your guess"
        >
          <div className="mx-auto grid w-fit gap-1">
            {rows.map((row, r) => (
              <div key={r} className="flex gap-1">
                {row.letters.map((l, i) => {
                  const m = row.marks[i];
                  return (
                    <span
                      key={i}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-md border-2 text-lg font-bold uppercase",
                        m ? TILE[m] : l.trim() ? "border-foreground/40" : "border-border",
                      )}
                      aria-label={l.trim() ? `${l}${m ? `, ${LABEL[m]}` : ""}` : "empty"}
                    >
                      {l.trim()}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="min-h-5 text-center text-sm" aria-live="polite">
            {message ??
              (game.status === "won"
                ? `Got it in ${game.rows.length}! New word tomorrow.`
                : game.status === "lost"
                  ? `The word was ${game.answer?.toUpperCase()}.`
                  : "")}
          </p>

          <div className="space-y-1" aria-label="Keyboard">
            {KEYS.map((line, i) => (
              <div key={line} className="flex justify-center gap-1">
                {i === 2 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 px-2 text-xs"
                    onClick={() => press("enter")}
                    disabled={busy || game.status !== "playing"}
                  >
                    Enter
                  </Button>
                )}
                {[...line].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => press(k)}
                    disabled={game.status !== "playing"}
                    aria-label={`${k}${keyState[k] ? `, ${LABEL[keyState[k]]}` : ""}`}
                    className={cn(
                      "bg-secondary h-9 w-6 rounded-md text-xs font-semibold uppercase sm:w-7",
                      keyState[k] && TILE[keyState[k]],
                    )}
                  >
                    {k}
                  </button>
                ))}
                {i === 2 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 px-2"
                    onClick={() => press("back")}
                    aria-label="Delete a letter"
                    disabled={game.status !== "playing"}
                  >
                    <Delete className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
