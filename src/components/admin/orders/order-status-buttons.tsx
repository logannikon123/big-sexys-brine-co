"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateOrderStatus } from "@/app/admin/orders/actions";
import {
  allowedMoves,
  moveButtonLabel,
  statusLabel,
  type AdminMoveStatus,
} from "./order-flow";
import { emailKindForStep } from "@/lib/orders/customer-emails";
import type { FulfillmentType, OrderStatus } from "@/types/orders";

interface OrderStatusButtonsProps {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  hasTracking: boolean;
  /** Demo orders: show a message instead of saving. */
  demo: boolean;
}

/** Why there are no buttons, for orders with no next step. */
function noMovesMessage(status: OrderStatus): string {
  switch (status) {
    case "pending_payment":
      return "The customer hasn't finished paying. Nothing to do yet.";
    case "payment_failed":
      return "The payment didn't go through, so there is nothing to pack.";
    case "cancelled":
      return "This order is cancelled. Nothing left to do.";
    default:
      return "This order is finished. Nothing left to do.";
  }
}

/** The step in the words of the email note: "ready for pickup or cancelled". */
const EMAIL_STEP_WORDS: Record<AdminMoveStatus, string> = {
  ready_for_pickup: "ready for pickup",
  out_for_delivery: "out for delivery",
  shipped: "shipped",
  fulfilled: "delivered",
  cancelled: "cancelled",
};

/** Which of these steps email the customer, in a sentence, or null for none. */
function emailNote(
  moves: readonly AdminMoveStatus[],
  type: FulfillmentType
): string | null {
  const words = moves
    .filter((m) => emailKindForStep(m, type))
    .map((m) => EMAIL_STEP_WORDS[m]);
  if (words.length === 0) return null;
  const list =
    words.length === 1
      ? words[0]
      : `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
  return `The customer gets an email when you mark this order ${list}.`;
}

export function OrderStatusButtons({
  orderId,
  orderNumber,
  status,
  fulfillmentType,
  hasTracking,
  demo,
}: OrderStatusButtonsProps) {
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);

  const moves = allowedMoves(fulfillmentType, status);
  const forward = moves.filter((m) => m !== "cancelled");
  const canCancel = moves.includes("cancelled");
  const doneWords =
    fulfillmentType === "class"
      ? "attended"
      : fulfillmentType === "pickup"
        ? "picked up"
        : "delivered";
  const note = emailNote(moves, fulfillmentType);

  function closeDialogs() {
    setConfirmCancel(false);
    setConfirmDone(false);
  }

  function move(next: AdminMoveStatus) {
    if (demo) {
      toast.info("Demo only, nothing saved");
      closeDialogs();
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateOrderStatus(orderId, next);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(
            `Order #${orderNumber} is now "${statusLabel(next)}"`
          );
        }
      } catch {
        toast.error(
          "Something went wrong and nothing was saved. Check your connection and try again."
        );
      } finally {
        closeDialogs();
      }
    });
  }

  return (
    <div className="space-y-3">
      {moves.length === 0 && (
        <p className="text-sm text-muted-foreground">{noMovesMessage(status)}</p>
      )}

      {forward.map((next) => {
        const needsTracking = next === "shipped" && !hasTracking;
        return (
          <div key={next} className="space-y-1">
            <Button
              type="button"
              className="h-12 w-full text-base"
              disabled={pending || needsTracking}
              // Completing an order can't be undone, so ask first.
              onClick={() =>
                next === "fulfilled" ? setConfirmDone(true) : move(next)
              }
            >
              {pending ? "Saving..." : moveButtonLabel(next, fulfillmentType)}
            </Button>
            {needsTracking && (
              <p className="text-xs text-muted-foreground">
                Save a tracking number below first.
              </p>
            )}
          </div>
        );
      })}

      {canCancel && (
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full text-base text-red-300 hover:text-red-200"
          disabled={pending}
          onClick={() => setConfirmCancel(true)}
        >
          Cancel order
        </Button>
      )}

      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel order #{orderNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks the order cancelled and emails the customer to say
            so. It does not give the customer their money back. To do that,
            open the payment in your Square Dashboard and refund it there.
            The refund then shows up on this order, and the customer gets
            a refund email.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="h-11"
            onClick={() => setConfirmCancel(false)}
          >
            Keep order
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={() => move("cancelled")}
          >
            {pending ? "Cancelling..." : "Cancel order"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>

      <AlertDialog open={confirmDone} onOpenChange={setConfirmDone}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Mark order #{orderNumber} as {doneWords}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone. The order drops to the bottom of To
            do, marked Completed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="h-11"
            onClick={() => setConfirmDone(false)}
          >
            Not yet
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11"
            disabled={pending}
            onClick={() => move("fulfilled")}
          >
            {pending ? "Saving..." : moveButtonLabel("fulfilled", fulfillmentType)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  );
}
