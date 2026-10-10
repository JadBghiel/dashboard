"use client";

/** load a game's state, then play moves against the server. a move's error (wrong word, already
 * tried) is a message for the player, the game state itself stays as it was */

import { useCallback, useEffect, useState } from "react";

type Answer<S> = { state: S } | { error: string };

// the typed client returns a union of json bodies, this narrows it to state or { message }
async function read<S>(res: Response | { json(): Promise<unknown> }): Promise<Answer<S>> {
  const body = (await res.json()) as S | { message: string };
  return body && typeof body === "object" && "message" in body && !("day" in body)
    ? { error: (body as { message: string }).message }
    : { state: body as S };
}

export function useGame<S>(
  load: (signal: AbortSignal) => Promise<{ json(): Promise<unknown> }>,
  key: string,
) {
  const [state, setState] = useState<{ key: string; game: S | null; error: string | null }>({
    key: "",
    game: null,
    error: null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchState = useCallback(
    (signal: AbortSignal) =>
      load(signal)
        .then((res) => read<S>(res))
        .then((answer) => {
          if (signal.aborted) return;
          setState(
            "state" in answer
              ? { key, game: answer.state, error: null }
              : { key, game: null, error: answer.error },
          );
        })
        .catch(() => {
          if (!signal.aborted) setState({ key, game: null, error: "Could not reach the server." });
        }),
    // load changes identity every render, the key is what says the game changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchState(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchState]);

  const play = useCallback(async (move: () => Promise<{ json(): Promise<unknown> }>) => {
    setBusy(true);
    setMessage(null);
    try {
      const answer = await read<S>(await move());
      if ("state" in answer) setState((s) => ({ ...s, game: answer.state }));
      else setMessage(answer.error);
      return "state" in answer;
    } catch {
      setMessage("Could not reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    game: state.key === key ? state.game : null,
    error: state.key === key ? state.error : null,
    loading: state.key !== key,
    busy,
    message,
    setMessage,
    play,
    refresh: () => fetchState(new AbortController().signal),
  };
}
