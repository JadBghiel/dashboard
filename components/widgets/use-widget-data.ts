"use client";

/** fetches 1 widget payload through the api, every card uses this, and its refresh() is what the
 * Timer (#25) will call on a schedule after */

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

type Result = { data: unknown } | { error: string };

async function fetchWidget(
  service: string,
  widget: string,
  paramsKey: string,
  signal: AbortSignal,
): Promise<Result> {
  try {
    const res = await api.widgets[":service"][":widget"].data.$post(
      { param: { service, widget }, json: { params: JSON.parse(paramsKey) } },
      { init: { signal } },
    );
    const body = await res.json();
    return "data" in body ? { data: body.data } : { error: body.message };
  } catch {
    return { error: "Could not reach the server." };
  }
}

// key says which request the data belongs to, loading isnt stored, its "the data is not for the
// current key yet", so nothing has to be set syncsly when the params or the location change
type Loaded<T> = { key: string | null; data: T | null; error: string | null };

export function useWidgetData<T>(
  service: string,
  widget: string,
  params: Record<string, unknown>,
  // changes when the user loc changes, so a card following "your location" refetches
  // (we alr have weather, maybe we will have news/traffic too idk)
  locationKey: string,
) {
  // params as a string so a new object w/ the same values doesnt refetch
  const paramsKey = JSON.stringify(params);
  const key = `${service}/${widget}/${paramsKey}/${locationKey}`;

  const [state, setState] = useState<Loaded<T>>({ key: null, data: null, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  const start = useCallback(() => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;

    fetchWidget(service, widget, paramsKey, ctrl.signal).then((result) => {
      if (ctrl.signal.aborted) return;
      setRefreshing(false);
      // a failed refresh keeps the last good data on screen, only the error is added
      setState((s) =>
        "data" in result
          ? { key, data: result.data as T, error: null }
          : { key, data: s.data, error: result.error },
      );
    });
    return ctrl;
  }, [service, widget, paramsKey, key]);

  useEffect(() => {
    const ctrl = start();
    return () => ctrl.abort();
  }, [start]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    start();
  }, [start]);

  return {
    data: state.data,
    error: state.error,
    loading: state.key !== key || refreshing,
    refresh,
  };
}
