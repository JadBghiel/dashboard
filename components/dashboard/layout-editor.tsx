"use client";

/** 1 dashboard section while editing the layout: every card becomes 1 big drag handle w/ a cross to
 * remove it, and its content goes inert, so a drag cant type into an input or open a link. drag w/ the
 * mouse or a finger, or from the keyboard: tab to a card, space to pick it up, arrows to move, space
 * to drop. a card moves inside its own section */

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

export type SectionItem = {
  id: string;
  // what the card is called when it's announced: "Weather"
  label: string;
  // grid placement inside the section, like "lg:col-span-3"
  className?: string;
  // a placeholder, not a saved widget: it stays put and has no cross
  fixed?: boolean;
  // where a fixed card sits among the others, 0 based. it never moves, the others flow around it
  at?: number;
  node: React.ReactNode;
};

const DEFAULT_GRID = "grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] items-start gap-4";

export function SortableSection({
  items,
  editing,
  onReorder,
  onRemove,
  grid = DEFAULT_GRID,
}: {
  items: SectionItem[];
  editing: boolean;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  // the section's own grid, the news one has fixed column spans
  grid?: string;
}) {
  // dnd-kit numbers its aria ids w/ a global counter, the server and the browser would disagree
  const id = useId();
  const sensors = useSensors(
    // a few px before a drag starts, so a plain click in edit mode doesnt jump a card
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortable = items.filter((i) => !i.fixed);
  // the fixed cards slotted in at their place, so dnd-kit lays out the grid w/ them in it
  const ordered = [...sortable];
  for (const f of items.filter((i) => i.fixed)) {
    ordered.splice(Math.min(f.at ?? ordered.length, ordered.length), 0, f);
  }
  const ids = ordered.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const label = (key: string | number) => byId.get(String(key))?.label ?? String(key);

  // said to screen readers w/ the card names instead of the internal ids
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${label(active.id)} is at position ${ids.indexOf(String(over.id)) + 1} of ${ids.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${label(active.id)} dropped at position ${ids.indexOf(String(over.id)) + 1} of ${ids.length}.`
        : `${label(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${label(active.id)} was cancelled.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    // only the saved widgets go to the server, a fixed card stays at its own place
    onReorder(moved.filter((i) => !byId.get(i)?.fixed));
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={onDragEnd}
      accessibility={{ announcements }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={grid}>
          {ordered.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              editing={editing && !item.fixed}
              movable={editing && !item.fixed && sortable.length > 1}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCard({
  item,
  editing,
  movable,
  onRemove,
}: {
  item: SectionItem;
  editing: boolean;
  // alone in its section: nothing to swap w/, so no drag, the cross still shows
  movable: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !movable,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative h-full rounded-xl",
        item.className,
        editing && "outline-muted-foreground/40 outline-2 outline-offset-4 outline-dashed",
        movable &&
          "focus-visible:ring-ring cursor-grab focus-visible:ring-2 active:cursor-grabbing",
        isDragging && "z-20 opacity-90 shadow-xl",
      )}
      {...(movable && { ...attributes, ...listeners, "aria-label": `Move ${item.label}` })}
    >
      {editing && (
        <>
          <span
            aria-hidden
            className="bg-background text-muted-foreground absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap shadow-sm"
          >
            {movable && <GripVertical className="size-3" />}
            {item.label}
          </span>
          <button
            type="button"
            onClick={onRemove}
            // kept away from the drag sensors, a press here removes the card and never picks it up
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`Remove ${item.label}`}
            className="bg-background text-muted-foreground hover:text-destructive focus-visible:ring-ring absolute -top-3 -right-3 z-10 flex size-7 items-center justify-center rounded-full border shadow-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        </>
      )}
      {/* inert while editing: no typing, clicking or tabbing into a card that's being moved */}
      <div inert={editing} className={cn("h-full", editing && "pointer-events-none select-none")}>
        {item.node}
      </div>
    </div>
  );
}
