"use client";

/** a signed in user's theme comes from the db. next-themes keeps a copy in the browser to paint the
 * right theme before react loads, this puts the saved one back if it was changed on another device */

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeSync({ saved }: { saved: string | null }) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (saved && theme && theme !== saved) setTheme(saved);
    // once on load: after that the toggle changes both the browser copy and the db together
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
