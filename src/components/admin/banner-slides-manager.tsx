"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SortableList } from "@/components/admin/sortable-list";
import { DeleteButton } from "@/components/admin/delete-button";
import { createClient } from "@/lib/supabase/client";
import { SHRINKABLE_TYPES, shrinkImage } from "@/lib/shrink-image";
import {
  MAX_SLIDES,
  type BannerProduct,
  type HomeBannerSlide,
  type SlideInput,
} from "@/lib/home-banner";
import {
  addBannerSlide,
  deleteBannerSlide,
  reorderBannerSlides,
  updateBannerSlide,
} from "@/app/admin/banner/actions";

interface BannerSlidesManagerProps {
  slides: HomeBannerSlide[];
  onChange: (slides: HomeBannerSlide[]) => void;
  products: BannerProduct[];
}

/** "IMG_1234-final.jpg" becomes "IMG 1234 final", a starting description. */
function altFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 200) || "Banner photo";
}

function detailsOf(slide: HomeBannerSlide): SlideInput {
  return { alt: slide.alt, caption: slide.caption, link_product_id: slide.link_product_id };
}

/**
 * Upload, describe, reorder and delete the banner photos. Unlike the rest of
 * the banner form, each change here saves straight away.
 */
export function BannerSlidesManager({ slides, onChange, products }: BannerSlidesManagerProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  // What each photo's details were when last saved, so leaving a box that
  // didn't change saves nothing.
  const saved = useRef(new Map(slides.map((s) => [s.id, detailsOf(s)])));
  const room = MAX_SLIDES - slides.length;

  const edit = (id: number, change: Partial<SlideInput>) =>
    onChange(slides.map((s) => (s.id === id ? { ...s, ...change } : s)));

  const save = async (slide: HomeBannerSlide) => {
    const details = detailsOf(slide);
    const before = saved.current.get(slide.id);
    if (before && JSON.stringify(before) === JSON.stringify(details)) return;
    const result = await updateBannerSlide(slide.id, details);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    saved.current.set(slide.id, details);
    toast.success("Photo saved");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    if (picked.length > room) {
      toast.error(
        room === 0
          ? `The banner holds ${MAX_SLIDES} photos at most. Delete one first.`
          : `Only ${room} more photo${room === 1 ? "" : "s"} fit, so only the first ${room} will be added.`
      );
    }
    const files = picked.slice(0, Math.max(room, 0));
    const supabase = createClient();
    let list = slides;

    for (const [i, file] of files.entries()) {
      setUploading(`Shrinking and uploading photo ${i + 1} of ${files.length}...`);
      try {
        const small = await shrinkImage(file);
        const path = `banner/${Date.now()}-${Math.random().toString(36).slice(2)}.${small.extension}`;
        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(path, small.blob, { contentType: small.blob.type });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        const {
          data: { publicUrl },
        } = supabase.storage.from("images").getPublicUrl(path);

        const result = await addBannerSlide({ url: publicUrl, alt: altFromFileName(file.name) });
        if (result.error || !result.slide) {
          // Don't leave an unused file behind.
          await supabase.storage.from("images").remove([path]);
          throw new Error(result.error ?? "The photo wasn't saved.");
        }
        saved.current.set(result.slide.id, detailsOf(result.slide));
        list = [...list, result.slide];
        onChange(list);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    }
    setUploading(null);
  };

  const handleDelete = async (id: number) => {
    const result = await deleteBannerSlide(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onChange(slides.filter((s) => s.id !== id));
    toast.success("Photo deleted");
  };

  const handleReorder = async (items: { id: number; sort_order: number }[]) => {
    const result = await reorderBannerSlides(items);
    if (result.error) {
      toast.error(result.error);
      // The list moves the photo back.
      throw new Error(result.error);
    }
    const order = new Map(items.map((item) => [item.id, item.sort_order]));
    onChange(
      [...slides]
        .map((s) => ({ ...s, sort_order: order.get(s.id) ?? s.sort_order }))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={
            room > 0 && !uploading
              ? "inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-within:ring-2 focus-within:ring-ring"
              : "inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground"
          }
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Add photos"}
          <input
            type="file"
            accept={SHRINKABLE_TYPES.join(",")}
            multiple
            onChange={handleUpload}
            className="sr-only"
            disabled={room <= 0 || Boolean(uploading)}
          />
        </label>
        <span className="text-sm text-muted-foreground">
          {slides.length} of {MAX_SLIDES} photos
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {uploading ??
          "Photos are shrunk before upload and save straight away. Drag the handle to change the order."}
      </p>

      {slides.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No photos yet. Without photos the banner shows just the words.
        </div>
      ) : (
        <SortableList
          // Start the list fresh when photos are added, removed or moved.
          key={slides.map((s) => s.id).join(",")}
          items={slides}
          onReorder={handleReorder}
          renderItem={(item) => {
            // The list keeps its own copy of each photo, so read the latest.
            const slide = slides.find((s) => s.id === item.id) ?? item;
            const position = slides.indexOf(slide) + 1;
            return (
              <div className="flex flex-col gap-3 py-3 pr-3 sm:flex-row sm:items-start">
                <Image
                  src={slide.url}
                  alt=""
                  width={120}
                  height={90}
                  className="h-[90px] w-[120px] shrink-0 rounded-md border border-border object-cover"
                />
                <div className="grid min-w-0 flex-1 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`slide-alt-${slide.id}`}>Describe photo {position}</Label>
                    <Input
                      id={`slide-alt-${slide.id}`}
                      value={slide.alt}
                      maxLength={200}
                      onChange={(e) => edit(slide.id, { alt: e.target.value })}
                      onBlur={() => save(slide)}
                    />
                    <p className="text-xs text-muted-foreground">
                      For people who can&apos;t see the photo, like &quot;Three jars of
                      pickled carrots on a market table&quot;.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`slide-caption-${slide.id}`}>Caption (optional)</Label>
                      <Input
                        id={`slide-caption-${slide.id}`}
                        value={slide.caption}
                        maxLength={80}
                        onChange={(e) => edit(slide.id, { caption: e.target.value })}
                        onBlur={() => save(slide)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`slide-product-${slide.id}`}>Photo links to</Label>
                      <Select
                        id={`slide-product-${slide.id}`}
                        value={slide.link_product_id ?? ""}
                        onChange={(e) => {
                          const link_product_id = e.target.value ? Number(e.target.value) : null;
                          edit(slide.id, { link_product_id });
                          save({ ...slide, link_product_id });
                        }}
                      >
                        <option value="">No product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
                <DeleteButton itemName={`photo ${position}`} onDelete={() => handleDelete(slide.id)} />
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
