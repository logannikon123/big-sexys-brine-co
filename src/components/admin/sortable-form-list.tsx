"use client";

import { useId } from "react";
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
import { GripVertical, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SortableFormItemProps {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}

function SortableFormItem({
  id,
  value,
  placeholder,
  onChange,
  onRemove,
}: SortableFormItemProps) {
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
        "flex items-center gap-2",
        isDragging && "z-50 opacity-90"
      )}
    >
      <button
        type="button"
        className="flex items-center justify-center p-1 text-muted-foreground hover:text-foreground touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-destructive shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface SortableFormListProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}

export function SortableFormList({
  items,
  onChange,
  placeholder = "Item",
  addLabel = "Add Item",
}: SortableFormListProps) {
  const instanceId = useId();

  // Generate stable IDs for each item based on index
  // We use a prefix + index approach since items are strings without inherent IDs
  const itemIds = items.map((_, index) => `${instanceId}-${index}`);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = itemIds.indexOf(active.id as string);
      const newIndex = itemIds.indexOf(over.id as string);
      onChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  const updateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, ""]);
  };

  return (
    <div className="space-y-3">
      <DndContext
        id={instanceId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item, index) => (
              <SortableFormItem
                key={itemIds[index]}
                id={itemIds[index]}
                value={item}
                placeholder={placeholder}
                onChange={(value) => updateItem(index, value)}
                onRemove={() => removeItem(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        <Plus className="mr-2 h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
