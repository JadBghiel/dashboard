"use client";

/** the row above the dashboard: edit layout, add widgets, and while editing reset the order. w/ nobody
 * signed in theres nothing to save to, so it says so instead */

import { Check, LayoutGrid, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Toolbar({
  signedIn,
  editing,
  onToggleEditing,
  onAdd,
  onReset,
  error,
}: {
  signedIn: boolean;
  editing: boolean;
  onToggleEditing: () => void;
  onAdd: () => void;
  onReset: () => void;
  error: string | null;
}) {
  return (
    <>
      {signedIn ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={onToggleEditing}
            aria-pressed={editing}
          >
            {editing ? <Check /> : <LayoutGrid />}
            {editing ? "Done" : "Edit layout"}
          </Button>
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus />
            Add widgets
          </Button>
          {editing && (
            <>
              <Button variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw />
                Reset order
              </Button>
              <p className="text-muted-foreground text-sm">
                Drag a card to move it, or tab to it and use space and the arrows. The cross hides
                it.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Sign in to choose your widgets, set their refresh rate and keep them on every device.
        </p>
      )}
    </>
  );
}
