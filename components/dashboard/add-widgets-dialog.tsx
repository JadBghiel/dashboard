"use client";

/** "add widgets": every widget the app has, grouped by section, each w/ an on/off switch. on = on the
 * dashboard, off = hidden. a hidden widget keeps its settings, switching it back on brings it back as
 * it was, in its old place */

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CARDS, type SectionId } from "@/components/widgets/registry";

import type { Spec } from "./dashboard";

const TITLES: Record<SectionId, string> = { utility: "Utility", news: "News", games: "Games" };

export function AddWidgetsDialog({
  open,
  onOpenChange,
  specs,
  shown,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specs: Record<string, Spec>;
  // the widget keys on the dashboard right now
  shown: Set<string>;
  onToggle: (widgetKey: string, on: boolean) => Promise<unknown>;
}) {
  // the switch being saved, disabled until the server answers so a double click cant race
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(widgetKey: string, on: boolean) {
    setBusy(widgetKey);
    await onToggle(widgetKey, on);
    setBusy(null);
  }

  const keys = Object.keys(CARDS).filter((k) => specs[k]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add widgets</DialogTitle>
          <DialogDescription>
            Switch a widget on to put it on your dashboard, off to hide it. Its settings are kept.
          </DialogDescription>
        </DialogHeader>

        {(Object.keys(TITLES) as SectionId[]).map((section) => (
          <div key={section} className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {TITLES[section]}
            </h3>
            <ul className="divide-y rounded-lg border">
              {keys
                .filter((k) => CARDS[k].section === section)
                .map((k) => {
                  const id = `widget-${k.replace("/", "-")}`;
                  return (
                    <li key={k} className="flex items-center justify-between gap-4 px-3 py-2.5">
                      <div className="min-w-0">
                        <Label htmlFor={id} className="font-medium">
                          {specs[k].name}
                        </Label>
                        <p className="text-muted-foreground text-xs">{specs[k].description}</p>
                      </div>
                      <Switch
                        id={id}
                        checked={shown.has(k)}
                        disabled={busy === k}
                        onCheckedChange={(on) => toggle(k, on)}
                      />
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
