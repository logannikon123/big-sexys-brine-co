"use client";

import { useId, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableItemProps {
  id: number;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-card",
        isDragging && "z-50 shadow-lg opacity-90"
      )}
    >
      <button
        className="flex items-center justify-center p-3 text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

interface SortableListProps<T extends { id: number; sort_order: number }> {
  items: T[];
  onReorder: (items: { id: number; sort_order: number }[]) => Promise<void>;
  renderItem: (item: T) => React.ReactNode;
}

export function SortableList<T extends { id: number; sort_order: number }>({
  items: initialItems,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const dndId = useId();
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      setSaving(true);
      try {
        const updates = newItems.map((item, index) => ({
          id: item.id,
          sort_order: index,
        }));
        await onReorder(updates);
      } catch (error) {
        // Revert on error
        setItems(items);
        console.error("Failed to save order:", error);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="space-y-2">
      {saving && (
        <div className="text-xs text-muted-foreground animate-pulse">
          Saving order...
        </div>
      )}
      <DndContext
        // A fixed id keeps dnd-kit's screen reader labels the same in the
        // server render and the browser, so React logs no mismatch warning.
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {items.map((item) => (
              <SortableItem key={item.id} id={item.id}>
                {renderItem(item)}
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
