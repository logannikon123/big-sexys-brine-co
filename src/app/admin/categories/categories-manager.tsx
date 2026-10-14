"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryOrder,
} from "@/app/admin/actions";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
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

interface Category {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

function SortableCategoryItem({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = () => {
    if (editName.trim()) {
      onEdit(category.id, editName.trim());
      setEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2",
        isDragging && "z-50 shadow-lg opacity-90"
      )}
    >
      <button
        className="flex items-center justify-center text-muted-foreground hover:text-foreground touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {editing ? (
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
          <Button type="button" size="sm" variant="ghost" onClick={handleSave}>
            <Check className="h-4 w-4 text-green-500" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setEditName(category.name);
            }}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium">{category.name}</span>
          <span className="text-xs text-muted-foreground">{category.slug}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => onDelete(category.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}

export function CategoriesManager({
  categories: initialCategories,
}: {
  categories: Category[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createCategory({ name: newName.trim() });
      toast.success("Category created");
      setNewName("");
      // Reload page to get fresh data
      window.location.reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create category"
      );
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (id: number, name: string) => {
    try {
      await updateCategory(id, { name });
      setCategories(
        categories.map((c) =>
          c.id === id
            ? {
                ...c,
                name,
                slug: name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, ""),
              }
            : c
        )
      );
      toast.success("Category updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update category"
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this category? Products using it will lose this category assignment.")) return;
    try {
      await deleteCategory(id);
      setCategories(categories.filter((c) => c.id !== id));
      toast.success("Category deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete category"
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      const newCategories = arrayMove(categories, oldIndex, newIndex);
      setCategories(newCategories);

      setSaving(true);
      try {
        const updates = newCategories.map((c, index) => ({
          id: c.id,
          sort_order: index,
        }));
        await updateCategoryOrder(updates);
      } catch {
        setCategories(categories);
        toast.error("Failed to save order");
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {adding ? "Adding..." : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Categories ({categories.length})
            {saving && (
              <span className="ml-2 text-xs text-muted-foreground animate-pulse font-normal">
                Saving order...
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {categories.map((category) => (
                  <SortableCategoryItem
                    key={category.id}
                    category={category}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No categories yet. Add one above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
