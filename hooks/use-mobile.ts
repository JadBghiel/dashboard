import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

// rewritten from the shadcn default, which set state inside an effect to correct the ssr value
// and trips react-hooks/set-state-in-effect. useSyncExternalStore is what matchMedia wants anyway

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

// no viewport on the server, assume desktop and let the subscription correct it after hydration
function getServerSnapshot() {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
