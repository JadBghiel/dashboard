"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** thin wrapper so the root layout stays a server component */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
