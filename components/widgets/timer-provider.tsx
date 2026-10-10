"use client";

/** the Timer the subject asks for: 1 schedule for the whole dashboard. each card tells it its
 * refresh rate through useWidgetData, a 1s tick refreshes what is due, nothing runs while the tab is
 * hidden and the overdue cards catch up, spread, when it comes back */

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { Schedule } from "@/lib/timer";

type Timer = {
  schedule: Schedule;
  // "service/widget" -> seconds, the widget's default rate from the registry. a saved widget's own
  // rate wins, useWidgetData reads it from the instance
  rates: Record<string, number>;
};

const TimerContext = createContext<Timer | null>(null);

export function TimerProvider({
  rates,
  children,
}: {
  rates: Record<string, number>;
  children: React.ReactNode;
}) {
  const [schedule] = useState(() => new Schedule());

  useEffect(() => {
    const timeouts: number[] = [];
    const tick = window.setInterval(() => schedule.tick(), 1000);

    function onVisibility() {
      if (document.hidden) {
        schedule.pause();
        return;
      }
      for (const { run, delayMs } of schedule.resume()) {
        timeouts.push(window.setTimeout(run, delayMs));
      }
    }
    if (document.hidden) schedule.pause();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(tick);
      timeouts.forEach((t) => window.clearTimeout(t));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [schedule]);

  // memoized, a new object here would make every card re-register and restart its countdown
  const value = useMemo(() => ({ schedule, rates }), [schedule, rates]);
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

/** null outside the dashboard, the cards then just fetch once */
export const useTimer = () => useContext(TimerContext);
