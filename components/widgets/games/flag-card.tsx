"use client";

/** flag guesser: the flag image comes from our own server (/api/games/flags/today.png) so its file
 * name cant give the country away, and the guess box autocompletes from every country */

import { ArrowUp, Flag } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import { FooterLink } from "../footer-link";
import { WidgetCard } from "../widget-card";

import { useGame } from "./use-game";

type FlagState = {
  day: string;
  number: number;
  maxGuesses: number;
  hints: boolean;
  guesses: {
    code: string;
    name: string;
    correct: boolean;
    distanceKm: number | null;
    bearing: number | null;
  }[];
  status: "playing" | "won" | "lost";
  answer: { code: string; name: string } | null;
  countries: { code: string; name: string }[];
};

const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];
const direction = (bearing: number) => COMPASS[Math.round(bearing / 45) % 8];

type Props = { tries?: number; hints?: boolean };

export function FlagCard({ tries = 6, hints = true }: Props) {
  const query = { tries: String(tries), hints: String(hints) as "true" | "false" };
  const { game, error, loading, busy, message, play, refresh } = useGame<FlagState>(
    (signal) => api.games.flags.$get({ query }, { init: { signal } }),
    `${tries}|${hints}`,
  );
  const [guess, setGuess] = useState("");
  const listId = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim() || busy) return;
    const ok = await play(() => api.games.flags.$post({ query, json: { guess } }));
    if (ok) setGuess("");
  }

  return (
    <WidgetCard
      icon={<Flag className="size-5 text-red-500" aria-hidden />}
      title="Flag guesser"
      subtitle={
        game ? `#${game.number} · ${game.guesses.length}/${game.maxGuesses} tries` : undefined
      }
      loading={loading}
      error={error}
      hasData={!!game}
      onRefresh={refresh}
      footer={<FooterLink href="https://www.flagle.io/">Play Flagle</FooterLink>}
    >
      {game && (
        <div className="space-y-3">
          {/* day in the url so the browser cache doesnt keep yesterday's flag */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/games/flags/today.png?d=${game.day}`}
            alt="Today's flag, which country is it?"
            className="border-border mx-auto h-28 w-auto rounded-md border object-contain"
          />

          {game.status === "playing" ? (
            <form onSubmit={submit} className="flex gap-2">
              <Input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                list={listId}
                placeholder="Type a country"
                aria-label="Your guess"
                autoComplete="off"
              />
              <datalist id={listId}>
                {game.countries.map((c) => (
                  <option key={c.code} value={c.name} />
                ))}
              </datalist>
              <Button type="submit" disabled={busy || !guess.trim()}>
                Guess
              </Button>
            </form>
          ) : (
            <p
              className={cn(
                "text-center font-medium",
                game.status === "won" ? "text-emerald-600" : "text-red-600",
              )}
            >
              {game.status === "won"
                ? `Yes, ${game.answer?.name}! In ${game.guesses.length}.`
                : `It was ${game.answer?.name}.`}
            </p>
          )}

          {message && (
            <p role="alert" className="text-destructive text-center text-sm">
              {message}
            </p>
          )}

          <ul className="space-y-1" aria-label="Your guesses" aria-live="polite">
            {game.guesses.map((g) => (
              <li
                key={g.code}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
                  g.correct ? "bg-emerald-600/15" : "bg-muted/60",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                {g.correct ? (
                  <span className="text-emerald-600">Correct</span>
                ) : (
                  g.distanceKm !== null &&
                  g.bearing !== null && (
                    <span className="text-muted-foreground flex items-center gap-1 tabular-nums">
                      {g.distanceKm.toLocaleString()} km
                      <ArrowUp
                        className="size-4"
                        style={{ transform: `rotate(${g.bearing}deg)` }}
                        aria-label={`to the ${direction(g.bearing)}`}
                      />
                    </span>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetCard>
  );
}
