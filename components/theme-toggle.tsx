"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// a signed in user's choice is saved to their settings too, so it follows them to other devices
export function ThemeToggle({ signedIn = false }: { signedIn?: boolean }) {
  const { setTheme: setLocal } = useTheme();
  const setTheme = (theme: "system" | "light" | "dark") => {
    setLocal(theme);
    if (signedIn) api.settings.$patch({ json: { theme } }).catch(() => {});
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* the 2 icons are swapped in css, not from state, so nothing is read during render
            and the server and client markup stay identical */}
        <Button variant="ghost" size="icon" aria-label="change theme">
          <Sun className="size-5 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-5 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
