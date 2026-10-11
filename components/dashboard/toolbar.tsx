"use client";

/** the dashboard's header row: the title on the left, edit layout and add widgets on the right, and
 * while editing the reset btn and how to move a card. w/ nobody signed in theres nothing to save to,
 * so the right side offers to log in instead */

import { Check, LayoutGrid, LogIn, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function Toolbar({
  heading,
  signedIn,
  editing,
  onToggleEditing,
  onAdd,
  onReset,
  error,
}: {
  heading: React.ReactNode;
  signedIn: boolean;
  editing: boolean;
  onToggleEditing: () => void;
  onAdd: () => void;
  onReset: () => void;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {heading}
        {signedIn ? (
          <div className="flex flex-wrap items-center gap-2">
            {editing && (
              <Button variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw />
                Reset order
              </Button>
            )}
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
              Add widget
            </Button>
          </div>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/log-in">
              <LogIn />
              Log in
            </Link>
          </Button>
        )}
      </div>
      {editing && (
        <p className="text-muted-foreground text-sm">
          Drag a card to move it, or tab to it and use space and the arrows. The cross removes it.
        </p>
      )}
      {!signedIn && (
        <p className="text-muted-foreground text-sm">
          Log in to choose your widgets, set their refresh rate and keep them on every device.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
