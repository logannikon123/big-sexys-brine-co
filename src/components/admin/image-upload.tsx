"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, X } from "lucide-react";
import Image from "next/image";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
}

export function ImageUpload({
  value,
  onChange,
  bucket = "images",
  folder = "products",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(fileName);

      onChange(publicUrl);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          <Image
            src={value}
            alt="Upload preview"
            width={200}
            height={200}
            className="rounded-md border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-8 transition-colors hover:border-muted-foreground">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {uploading ? "Uploading..." : "Click to upload image"}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
