"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { unsubscribeMarketing } from "@/app/admin/marketing/actions";

interface UnsubscribeButtonProps {
  email: string;
  name: string | null;
  className?: string;
}

/** Asks first, then takes the person off the marketing list. */
export function UnsubscribeButton({ email, name, className }: UnsubscribeButtonProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const who = name ? `${name} (${email})` : email;
  const noteId = useId();

  const handleUnsubscribe = async () => {
    setSaving(true);
    try {
      const result = await unsubscribeMarketing(email, note);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${email} unsubscribed`);
        setOpen(false);
        setNote("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unsubscribe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        Unsubscribe
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsubscribe {who}?</AlertDialogTitle>
          <AlertDialogDescription>
            They come off the list now. Their past records stay in the consent
            log. They can join again by ticking the box at checkout or on the
            contest form.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={noteId}>Note (optional)</Label>
          <Textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Like: unsubscribed through the email link"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUnsubscribe}
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={saving}
          >
            {saving ? "Unsubscribing..." : "Unsubscribe"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}
