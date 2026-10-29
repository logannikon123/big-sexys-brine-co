"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { formatPrice } from "@/lib/utils";
import { daysUntilClass, refundDue } from "@/lib/classes/format";
import { FULL_REFUND_DAYS } from "@/types/classes";
import { cancelClassBooking } from "@/app/admin/classes/actions";
import {
  CANCEL_NOTE_MAX,
  refundableCents,
  seatWords,
  type AdminClassBooking,
} from "./class-rows";

interface CancelBookingButtonProps {
  booking: AdminClassBooking;
  startsAt: string;
}

/** Ends "The class ...": "is 3 days away", "is less than a day away". */
function whenWords(startsAt: string): string {
  const days = daysUntilClass(startsAt);
  if (new Date(startsAt).getTime() <= Date.now()) return "has already started";
  if (days < 1) return "is less than a day away";
  return days === 1 ? "is 1 day away" : `is ${days} days away`;
}

/** Why the site can't give money back for this booking, or null when it can. */
function noRefundReason(booking: AdminClassBooking): string | null {
  const order = booking.order;
  if (!order) return "The order didn't load, so the site can't refund it.";
  if (order.status === "pending_payment") {
    return "The customer hasn't finished paying, so there is nothing to refund. Cancelling frees the seats. If their payment goes through later, refund it in your Square Dashboard.";
  }
  if (order.status === "payment_failed") return "The payment failed, so there is nothing to refund.";
  if (order.refunded_cents >= order.total_cents) return "This order was already refunded in full.";
  if (!order.has_payment) {
    return "There is no Square payment on file, so the site can't refund it. Refund it in your Square Dashboard if you need to.";
  }
  return null;
}

/**
 * The "Cancel booking" button and its box. A refund is ticked to start with
 * when the class is 7 or more days away. Inside that, Jesse must tick
 * "Special case" before he can refund.
 */
export function CancelBookingButton({ booking, startsAt }: CancelBookingButtonProps) {
  const [open, setOpen] = useState(false);
  const [refund, setRefund] = useState(false);
  const [specialCase, setSpecialCase] = useState(false);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const amount = refundableCents(booking.order);
  const cantRefund = noRefundReason(booking);
  const canRefund = amount > 0 && cantRefund === null;
  // Worked out when the box opens, so it matches the moment Jesse decides.
  const [due, setDue] = useState(false);
  const refundAllowed = canRefund && (due || specialCase);

  function openBox() {
    const isDue = refundDue(startsAt);
    setDue(isDue);
    setRefund(isDue && canRefund);
    setSpecialCase(false);
    setNote("");
    setProblem(null);
    setOpen(true);
  }

  function toggleSpecialCase(checked: boolean) {
    setSpecialCase(checked);
    setRefund(checked);
  }

  function submit() {
    const willRefund = refund && refundAllowed;
    startTransition(async () => {
      try {
        const result = await cancelClassBooking(booking.id, {
          refund: willRefund,
          specialCase: !due && specialCase,
          note,
        });
        if (result.error) {
          setProblem(result.error);
          return;
        }
        toast.success(result.message ?? "Booking cancelled");
        setOpen(false);
      } catch {
        setProblem("Something went wrong and nothing was saved. Check your connection and try again.");
      }
    });
  }

  const orderNumber = booking.order?.order_number;
  const willRefund = refund && refundAllowed;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-11 text-red-300 hover:text-red-200"
        onClick={openBox}
      >
        Cancel booking
      </Button>

      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel {booking.order?.customer_name ?? "this"}&apos;s booking
              {orderNumber ? ` (order #${orderNumber})` : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This frees {seatWords(booking.seats)} and marks the order
              cancelled. The class {whenWords(startsAt)}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {cantRefund ? (
            <p className="rounded-md border border-border bg-muted/50 p-3 text-sm">{cantRefund}</p>
          ) : due ? (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              That is {FULL_REFUND_DAYS} or more days before class, so a full refund is due.
            </p>
          ) : (
            <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p>
                That is less than {FULL_REFUND_DAYS} days before class, so no refund is due.
              </p>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-brand-orange"
                  checked={specialCase}
                  onChange={(e) => toggleSpecialCase(e.target.checked)}
                  disabled={pending}
                />
                <span>Special case: refund anyway (an emergency, say)</span>
              </label>
            </div>
          )}

          {canRefund && (
            <label
              className={`flex min-h-11 items-center gap-3 text-sm ${refundAllowed ? "cursor-pointer" : "opacity-50"}`}
            >
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-brand-orange"
                checked={willRefund}
                onChange={(e) => setRefund(e.target.checked)}
                disabled={!refundAllowed || pending}
              />
              <span>
                Refund {formatPrice(amount)} to the customer&apos;s card through Square
              </span>
            </label>
          )}
          {canRefund && due && !refund && (
            <p className="text-xs text-amber-300">
              The customer won&apos;t get their money back.
            </p>
          )}

          <div className="space-y-2">
            <label htmlFor={`cancel-note-${booking.id}`} className="text-sm font-medium">
              Note for your records (optional)
            </label>
            <Textarea
              id={`cancel-note-${booking.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={CANCEL_NOTE_MAX}
              rows={3}
              placeholder="Why it was cancelled. The customer doesn't see this."
              disabled={pending}
            />
            <p className="text-right text-xs text-muted-foreground">
              {note.length} / {CANCEL_NOTE_MAX}
            </p>
          </div>

          {problem && (
            <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {problem}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="h-11" disabled={pending} onClick={() => setOpen(false)}>
              Keep booking
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={submit}
            >
              {pending
                ? "Cancelling..."
                : willRefund
                  ? `Cancel and refund ${formatPrice(amount)}`
                  : "Cancel without refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialog>
    </>
  );
}
