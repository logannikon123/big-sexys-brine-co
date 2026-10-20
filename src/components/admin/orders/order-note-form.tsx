"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveAdminNote } from "@/app/admin/orders/actions";

interface OrderNoteFormProps {
  orderId: string;
  note: string | null;
  demo: boolean;
}

export function OrderNoteForm({ orderId, note, demo }: OrderNoteFormProps) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(note ?? "");
  const changed = text.trim() !== (note ?? "").trim();

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (demo) {
      toast.info("Demo only, nothing saved");
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveAdminNote(orderId, text);
        if (result.error) toast.error(result.error);
        else toast.success("Note saved");
      } catch {
        toast.error(
          "Something went wrong and nothing was saved. Check your connection and try again."
        );
      }
    });
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Textarea
        aria-label="Your notes"
        className="min-h-24 text-base"
        maxLength={2000}
        placeholder="Only you see these notes. The customer never does."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        type="submit"
        variant="secondary"
        className="h-11 w-full"
        disabled={pending || !changed}
      >
        {pending ? "Saving..." : "Save note"}
      </Button>
    </form>
  );
}
