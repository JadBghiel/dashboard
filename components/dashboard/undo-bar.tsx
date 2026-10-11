"use client";

/** "weather removed · undo", at the bottom of the screen for a few seconds after the cross. undo puts
 * the widget back as it was, its options, its refresh rate and its place */

import { X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

const SHOWN_MS = 8000;

export function UndoBar({
  label,
  onUndo,
  onClose,
}: {
  label: string;
  onUndo: () => void;
  onClose: () => void;
}) {
  // keyed on the label by the dashboard, so a 2nd removal starts its own 8 s
  useEffect(() => {
    const timer = setTimeout(onClose, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="status"
      className="bg-background fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border py-2 pr-2 pl-4 text-sm shadow-lg"
    >
      <span>{label} removed.</span>
      <Button size="sm" variant="outline" onClick={onUndo}>
        Undo
      </Button>
      <Button size="icon" variant="ghost" className="size-7" onClick={onClose} aria-label="Close">
        <X />
      </Button>
    </div>
  );
}
