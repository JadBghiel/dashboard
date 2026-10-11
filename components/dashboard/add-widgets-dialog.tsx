"use client";

/** "add a widget", in 2 steps: pick a widget from the list (grouped by section), then set its options
 * and refresh rate and add it. the same widget can be added as many times as you want, each copy
 * keeps its own settings (2 weathers, 1 for madrid and 1 for paris) */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CARDS, type SectionId } from "@/components/widgets/registry";
import { defaultParams, WidgetForm } from "@/components/widgets/settings-dialog";

import type { Spec } from "./dashboard";

const TITLES: Record<SectionId, string> = { utility: "Utility", news: "News", games: "Games" };

export function AddWidgetsDialog({
  open,
  onOpenChange,
  specs,
  counts,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specs: Record<string, Spec>;
  // how many of each widget are on the dashboard right now
  counts: Map<string, number>;
  // resolves to an error message, or null once added
  onAdd: (
    widgetKey: string,
    params: Record<string, unknown>,
    refreshSec: number,
  ) => Promise<string | null>;
}) {
  // the widget being configured, null = the list
  const [picked, setPicked] = useState<string | null>(null);

  const close = (next: boolean) => onOpenChange(next);

  const spec = picked ? specs[picked] : null;
  const keys = Object.keys(CARDS).filter((k) => specs[k]);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
        // back to the list once the window has faded out, not during: no flash of the list on close
        onCloseAutoFocus={() => setPicked(null)}
      >
        {picked && spec ? (
          <>
            <DialogHeader>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit"
                onClick={() => setPicked(null)}
              >
                <ChevronLeft />
                All widgets
              </Button>
              <DialogTitle>Add {spec.name}</DialogTitle>
              <DialogDescription>
                Set it up, you can change it later from its gear.
              </DialogDescription>
            </DialogHeader>
            <WidgetForm
              key={picked}
              spec={spec}
              notInSettings={CARDS[picked].notInSettings ?? []}
              ExtraSettings={CARDS[picked].ExtraSettings}
              initialParams={defaultParams(spec)}
              initialRefresh={spec.refresh.default}
              submitLabel="Add widget"
              onSubmit={(params, refreshSec) => onAdd(picked, params, refreshSec)}
              onCancel={() => close(false)}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a widget</DialogTitle>
              <DialogDescription>
                Pick a widget to set it up. You can add the same one more than once, each with its
                own settings.
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
                      const count = counts.get(k) ?? 0;
                      return (
                        <li key={k}>
                          <button
                            type="button"
                            onClick={() => setPicked(k)}
                            data-cursor={`pick-${k}`}
                            className="hover:bg-muted/50 focus-visible:bg-muted/50 flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left outline-none"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{specs[k].name}</span>
                              <span className="text-muted-foreground block text-xs">
                                {specs[k].description}
                              </span>
                            </span>
                            <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                              {count > 0 && `${count} on your dashboard`}
                              <ChevronRight className="size-4" aria-hidden />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
