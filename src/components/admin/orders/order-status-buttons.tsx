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
    case "refunded":
    case "partially_refunded":
      return "Square sets refunds. Nothing to do here.";
    case "disputed":
      return "The customer's bank is questioning this payment. Check the Square Dashboard for what to do.";
    default:
      return "This order is finished. Nothing left to do.";
  }
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

  const moves = allowedMoves(fulfillmentType, status);
  const forward = moves.filter((m) => m !== "cancelled");
  const canCancel = moves.includes("cancelled");

  function move(next: AdminMoveStatus) {
    if (demo) {
      toast.info("Demo only, nothing saved");
      setConfirmCancel(false);
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateOrderStatus(orderId, next);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(
            `Order #${orderNumber} is now "${statusLabel(next, fulfillmentType)}"`
          );
        }
      } catch {
        toast.error(
          "Something went wrong and nothing was saved. Check your connection and try again."
        );
      } finally {
        setConfirmCancel(false);
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
              onClick={() => move(next)}
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

      {moves.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Customer emails for these steps are coming soon.
        </p>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel order #{orderNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks the order cancelled. It does not give the customer
            their money back. To do that, open the payment in your Square
            Dashboard and refund it there. The refund then shows up on this
            order.
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
    </div>
  );
}
