import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";

import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSync } from "@/components/theme-sync";
import { TooltipProvider } from "@/components/ui/tooltip";
import { displaySettings } from "@/server/user-settings";

import "./globals.css";

// the var name has to match --font-sans in globals.css or font-sans resolves to nothing
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s · Dashboard",
  },
  description: "Build a dashboard of live widgets from the services you already use.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // text size and theme from the signed in user's settings, so the 1st paint is already right
  const display = await displaySettings(await headers());

  return (
    // next-themes sets the class on <html> before react hydrates, so the markup it produced
    // on the server never matches, suppressHydrationWarning tells react to accept the dom
    <html
      lang="en"
      suppressHydrationWarning
      data-text-size={display.textSize}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme={display.theme}
          enableSystem
          disableTransitionOnChange
        >
          <ThemeSync saved={display.signedIn ? display.theme : null} />
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
