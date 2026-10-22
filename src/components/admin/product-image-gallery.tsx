"use client";

import { useState, useId } from "react";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload,
  X,
  GripVertical,
  Star,
  Trash2,
  Plus,
  ImageIcon,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ProductImage {
  id: string; // temporary client-side id for new images, or db id for existing
  url: string;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
  db_id?: number; // actual database id for existing images
}

interface SortableImageCardProps {
  image: ProductImage;
  onRemove: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onUpdateAlt: (id: string, alt: string) => void;
}

function SortableImageCard({
  image,
  onRemove,
  onSetPrimary,
  onUpdateAlt,
}: SortableImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border-2 bg-card overflow-hidden",
        isDragging && "z-50 shadow-xl opacity-90",
        image.is_primary
          ? "border-brand-orange ring-2 ring-brand-orange/30"
          : "border-border"
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="absolute left-1 top-1 z-20 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 touch-none cursor-grab"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Primary badge */}
      {image.is_primary && (
        <div className="absolute left-1 bottom-1 z-20 rounded bg-brand-orange px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
          Primary
        </div>
      )}

      {/* Action buttons */}
      <div className="absolute right-1 top-1 z-20 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!image.is_primary && (
          <button
            type="button"
            onClick={() => onSetPrimary(image.id)}
            className="rounded bg-black/60 p-1 text-white hover:bg-brand-orange transition-colors cursor-pointer"
            title="Set as primary image"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(image.id)}
          className="rounded bg-black/60 p-1 text-white hover:bg-destructive transition-colors cursor-pointer"
          title="Remove image"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Image */}
      <div className="aspect-square relative">
        <Image
          src={image.url}
          alt={image.alt ?? "Product image"}
          fill
          className="object-cover"
          sizes="200px"
        />
      </div>

      {/* Alt text input */}
      <div className="p-1.5">
        <Input
          value={image.alt ?? ""}
          onChange={(e) => onUpdateAlt(image.id, e.target.value)}
          placeholder="Alt text"
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}

interface ProductImageGalleryProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}

export function ProductImageGallery({
  images,
  onChange,
}: ProductImageGalleryProps) {
  const instanceId = useId();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualAlt, setManualAlt] = useState("");

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
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      const newImages = arrayMove(images, oldIndex, newIndex).map(
        (img, index) => ({
          ...img,
          sort_order: index,
        })
      );
      onChange(newImages);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    setUploadProgress(0);
    const supabase = createClient();
    const newImages: ProductImage[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.round(((i) / files.length) * 100));

        const ext = file.name.split(".").pop();
        const fileName = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("images").getPublicUrl(fileName);

        newImages.push({
          id: `${instanceId}-new-${Date.now()}-${i}`,
          url: publicUrl,
          alt: file.name.replace(/\.[^.]+$/, ""),
          sort_order: images.length + i,
          is_primary: images.length === 0 && i === 0, // First image is primary if no images exist
        });
      }

      setUploadProgress(100);
      onChange([...images, ...newImages]);
      toast.success(`${files.length} image(s) uploaded`);
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Failed to upload one or more images");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset the file input
      e.target.value = "";
    }
  };

  const handleAddUrl = () => {
    if (!manualUrl.trim()) return;
    const newImage: ProductImage = {
      id: `${instanceId}-url-${Date.now()}`,
      url: manualUrl.trim(),
      alt: manualAlt.trim() || null,
      sort_order: images.length,
      is_primary: images.length === 0,
    };
    onChange([...images, newImage]);
    setManualUrl("");
    setManualAlt("");
    setShowUrlInput(false);
    toast.success("Image added");
  };

  const handleRemove = (id: string) => {
    const removedImage = images.find((img) => img.id === id);
    const remaining = images
      .filter((img) => img.id !== id)
      .map((img, index) => ({ ...img, sort_order: index }));

    // If we removed the primary image, make the first remaining image primary
    if (removedImage?.is_primary && remaining.length > 0) {
      remaining[0].is_primary = true;
    }

    onChange(remaining);
  };

  const handleSetPrimary = (id: string) => {
    const updated = images.map((img) => ({
      ...img,
      is_primary: img.id === id,
    }));
    onChange(updated);
  };

  const handleUpdateAlt = (id: string, alt: string) => {
    const updated = images.map((img) =>
      img.id === id ? { ...img, alt: alt || null } : img
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Upload controls */}
      <div className="flex flex-wrap gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <Upload className="h-4 w-4" />
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading {uploadProgress}%
            </>
          ) : (
            "Upload Images"
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowUrlInput(!showUrlInput)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add by URL
        </Button>
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div className="flex items-end gap-3 rounded-lg border border-border p-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Image URL</label>
            <Input
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://... or /images/products/..."
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">
              Alt text (optional)
            </label>
            <Input
              value={manualAlt}
              onChange={(e) => setManualAlt(e.target.value)}
              placeholder="Description of image"
            />
          </div>
          <Button type="button" onClick={handleAddUrl}>
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowUrlInput(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Image grid with drag and drop */}
      {images.length === 0 ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-12 transition-colors hover:border-muted-foreground">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No product images yet
            </p>
            <p className="text-xs text-muted-foreground/60">
              Click to upload or drag files here
            </p>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      ) : (
        <DndContext
          id={instanceId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((image) => (
                <SortableImageCard
                  key={image.id}
                  image={image}
                  onRemove={handleRemove}
                  onSetPrimary={handleSetPrimary}
                  onUpdateAlt={handleUpdateAlt}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Drag images to reorder. The primary image (marked with orange border)
          will be used as the main product image. Hover over images to see
          actions.
        </p>
      )}
    </div>
  );
}
