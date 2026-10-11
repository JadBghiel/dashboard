"use client";

/** 2048, played entirely in the browser. focus the board and use the arrows (or wasd), swipe on a
 * phone, or the buttons below. only the personal best goes to the server, per board size */

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  canMove,
  highest,
  move,
  newBoard,
  spawn,
  type Board,
  type Direction,
} from "@/lib/game-2048";
import { cn } from "@/lib/utils";

import { FooterLink } from "../footer-link";
import { useWidgetData } from "../use-widget-data";
import { WidgetCard } from "../widget-card";

type Config = { size: number; target: number };
type Props = { size?: number; target?: "1024" | "2048" | "4096" };

const KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

// dark text on the light tiles, white on the saturated ones, so every value stays readable
const TILE: Record<number, string> = {
  2: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100",
  4: "bg-stone-300 text-stone-800 dark:bg-stone-600 dark:text-stone-100",
  8: "bg-orange-300 text-orange-950",
  16: "bg-orange-400 text-orange-950",
  32: "bg-orange-600 text-white",
  64: "bg-red-600 text-white",
  128: "bg-yellow-300 text-yellow-950",
  256: "bg-yellow-400 text-yellow-950",
  512: "bg-amber-500 text-amber-950",
  1024: "bg-amber-600 text-white",
  2048: "bg-amber-700 text-white",
};
const tileClass = (n: number) => (n === 0 ? "bg-muted" : (TILE[n] ?? "bg-violet-600 text-white"));

export function Game2048Card({ size = 4, target = "2048" }: Props) {
  const { data, error, loading, refresh } = useWidgetData<Config>(
    "games",
    "game_2048",
    { size, target },
    "",
  );

  return (
    <WidgetCard
      icon={
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded bg-amber-500 text-[9px] font-bold text-white"
        >
          2k
        </span>
      }
      title="2048"
      subtitle={data ? `${data.size}×${data.size}, reach ${data.target}` : undefined}
      loading={loading}
      error={error}
      hasData={!!data}
      onRefresh={refresh}
      footer={<FooterLink href="https://play2048.co/">Play the original</FooterLink>}
    >
      {/* keyed on the config so a new size or target starts a fresh board */}
      {data && <Game key={`${data.size}-${data.target}`} size={data.size} target={data.target} />}
    </WidgetCard>
  );
}

type State = { board: Board; score: number; won: boolean; keepGoing: boolean };

const fresh = (size: number): State => ({
  board: newBoard(size),
  score: 0,
  won: false,
  keepGoing: false,
});

function Game({ size, target }: Config) {
  // only ever mounted in the browser after the config loaded, so the random board cant mismatch ssr
  const [state, setState] = useState<State>(() => fresh(size));
  const [best, setBest] = useState(0);
  const [announce, setAnnounce] = useState("");
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const over = !canMove(state.board);
  const paused = over || (state.won && !state.keepGoing);

  useEffect(() => {
    const ctrl = new AbortController();
    api.games["2048"].best
      .$get({ query: { size: String(size) } }, { init: { signal: ctrl.signal } })
      .then(async (res) => {
        if (res.ok) setBest((await res.json()).best);
      })
      .catch(() => {
        // no best yet or offline, the game plays the same
      });
    return () => ctrl.abort();
  }, [size]);

  // only reported when it counts: the game ended, was won, or is being thrown away
  function report(score: number) {
    if (score <= best) return;
    setBest(score);
    api.games["2048"].best.$put({ json: { size, score } }).catch(() => {});
  }

  function play(dir: Direction) {
    if (paused) return;
    const result = move(state.board, dir);
    if (!result.moved) return;
    const board = spawn(result.board);
    const score = state.score + result.gained;
    const won = state.won || highest(board) >= target;
    const next = { ...state, board, score, won };
    setState(next);

    if (!canMove(board)) {
      setAnnounce(`No moves left. Final score ${score}.`);
      report(score);
    } else if (won && !state.won) {
      setAnnounce(`You reached ${target}! Score ${score}.`);
      report(score);
    } else {
      setAnnounce(`Moved ${dir}. Score ${score}, highest tile ${highest(board)}.`);
    }
  }

  function restart() {
    report(state.score);
    setState(fresh(size));
    setAnnounce("New game.");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
    if (!dir) return;
    // the arrows would scroll the page otherwise
    e.preventDefault();
    play(dir);
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = pointer.current;
    pointer.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // a short tap isnt a swipe
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }

  const digits = size >= 6 ? "text-sm" : size === 5 ? "text-base" : "text-xl";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <p>
            <span className="text-muted-foreground">Score </span>
            <span className="font-semibold tabular-nums">{state.score}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Best </span>
            <span className="font-semibold tabular-nums">{Math.max(best, state.score)}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={restart}>
          <RotateCcw />
          New game
        </Button>
      </div>

      <div className="relative">
        <div
          role="group"
          tabIndex={0}
          aria-label="2048 board. Use the arrow keys or W A S D to slide the tiles"
          onKeyDown={onKeyDown}
          onPointerDown={(e) => (pointer.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (pointer.current = null)}
          // no scrolling or zooming while swiping on the board
          className="bg-muted/60 focus-visible:ring-ring grid aspect-square touch-none gap-1.5 rounded-xl p-1.5 outline-none select-none focus-visible:ring-2"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {state.board.flat().map((n, i) => (
            <div
              key={i}
              aria-hidden
              className={cn(
                "grid place-items-center rounded-lg font-bold tabular-nums transition-colors",
                digits,
                n >= 1024 && size >= 5 && "text-xs",
                tileClass(n),
              )}
            >
              {n || ""}
            </div>
          ))}
        </div>

        {paused && (
          <div className="bg-background/85 absolute inset-0 grid place-items-center rounded-xl text-center backdrop-blur-sm">
            <div className="space-y-2">
              <p className="font-semibold">{over ? "No moves left" : `You reached ${target}!`}</p>
              <div className="flex justify-center gap-2">
                {!over && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setState({ ...state, keepGoing: true })}
                  >
                    Keep going
                  </Button>
                )}
                <Button size="sm" onClick={restart}>
                  New game
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* for a mouse, or anyone who can't use the keys or swipe */}
      <div className="grid grid-cols-4 gap-1.5" aria-label="Slide the tiles">
        {(
          [
            ["left", ArrowLeft],
            ["up", ArrowUp],
            ["down", ArrowDown],
            ["right", ArrowRight],
          ] as const
        ).map(([dir, Icon]) => (
          <Button
            key={dir}
            variant="outline"
            size="sm"
            onClick={() => play(dir)}
            disabled={paused}
            aria-label={`Slide ${dir}`}
          >
            <Icon />
          </Button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
