"use client";

/** fetches 1 widget payload through the api, every card uses this. on the dashboard it registers
 * its refresh() w/ the Timer at the widget's rate, so the card refreshes on its own */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { api } from "@/lib/api";

import { useInstance } from "./instance-context";
import { useTimer } from "./timer-provider";

// locked = the service needs a key or a linked account first (403 not_subscribed)
type Result = { data: unknown } | { error: string; locked: boolean };

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
    if ("data" in body) return { data: body.data };
    return { error: body.message, locked: body.code === "not_subscribed" };
  } catch {
    return { error: "Could not reach the server.", locked: false };
  }
}

// key says which request the data belongs to, loading isnt stored, its "the data is not for the
// current key yet", so nothing has to be set syncsly when the params or the location change
type Loaded<T> = { key: string | null; data: T | null; error: string | null; locked: boolean };

export function useWidgetData<T>(
  service: string,
  widget: string,
  params: Record<string, unknown>,
  // changes when something the server reads from a cookie changes, so the card refetches: the
  // location for weather, the hearted tickers for the market
  refetchKey: string,
) {
  // params as a string so a new object w/ the same values doesnt refetch
  const paramsKey = JSON.stringify(params);
  const key = `${service}/${widget}/${paramsKey}/${refetchKey}`;

  const [state, setState] = useState<Loaded<T>>({
    key: null,
    data: null,
    error: null,
    locked: false,
  });
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
          ? { key, data: result.data as T, error: null, locked: false }
          : { key, data: s.data, error: result.error, locked: result.locked },
      );
    });
    return ctrl;
  }, [service, widget, paramsKey, key]);

  useEffect(() => {
    const ctrl = start();
    return () => ctrl.abort();
  }, [start]);

  const timer = useTimer();
  // 2 cards can show the same widget w/ the same params, each one needs its own timer slot
  const slot = useId();

  const refresh = useCallback(() => {
    setRefreshing(true);
    start();
    // a manual refresh restarts the countdown, a timer refresh lands here too, harmless
    timer?.schedule.reset(slot);
  }, [start, timer, slot]);

  // the timer keeps a stable function and calls the latest refresh through the ref
  const latestRefresh = useRef(refresh);
  useEffect(() => {
    latestRefresh.current = refresh;
  }, [refresh]);

  // the saved widget's own rate on the dashboard, the widget default otherwise
  const instanceRate = useInstance()?.instance.refreshSec;

  useEffect(() => {
    const everySec = instanceRate ?? timer?.rates[`${service}/${widget}`];
    if (!timer || !everySec) return;
    return timer.schedule.add(slot, () => latestRefresh.current(), everySec);
  }, [timer, slot, service, widget, instanceRate]);

  return {
    data: state.data,
    error: state.error,
    locked: state.locked,
    loading: state.key !== key || refreshing,
    refresh,
  };
}
