"use client";

/** a vertical list reorderable by dragging the grip, or from the keyboard: tab to the grip, space
 * to pick up, arrows to move, space to dro, used by stock and crypto */

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

export type SortableItem = {
  id: string;
  // what the grip is called for screen readersex: "Move AAPL"
  label: string;
  content: React.ReactNode;
};

type Props = {
  items: SortableItem[];
  onReorder: (ids: string[]) => void;
  className?: string;
};

export function SortableList({ items, onReorder, className }: Props) {
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((i) => i.id);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={cn("divide-y", className)} aria-live="polite">
          {items.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({ item }: { item: SortableItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card relative flex items-center gap-1 py-2",
        isDragging && "z-10 rounded-md shadow-lg",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Move ${item.label}`}
        className="text-muted-foreground hover:text-foreground -ml-1 flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      {item.content}
    </li>
  );
}
