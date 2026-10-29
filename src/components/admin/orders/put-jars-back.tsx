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
import { putJarsBack } from "@/app/admin/orders/actions";

interface PutJarsBackProps {
  orderId: string;
  orderNumber: number;
  /** Jars the order took off the stock counts. */
  jars: number;
  demo: boolean;
}

function jarWords(count: number): string {
  return count === 1 ? "1 jar" : `${count} jars`;
}

/**
 * A button that adds an order's jars back to the stock counts. Cancelling or
 * refunding doesn't do it by itself, because the jars may be gone.
 */
export function PutJarsBack({ orderId, orderNumber, jars, demo }: PutJarsBackProps) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function put() {
    setConfirm(false);
    if (demo) {
      toast.info("Demo only, nothing saved");
      return;
    }
    startTransition(async () => {
      try {
        const result = await putJarsBack(orderId);
        if (result.error) toast.error(result.error);
        else toast.success(`${jarWords(result.returned ?? jars)} back in stock`);
      } catch {
        toast.error("Something went wrong and nothing was saved. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="h-11 w-full"
        disabled={pending}
        onClick={() => setConfirm(true)}
      >
        {pending ? "Putting back..." : `Put ${jarWords(jars)} back in stock`}
      </Button>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogHeader>
          <AlertDialogTitle>Put the jars from order #{orderNumber} back?</AlertDialogTitle>
          <AlertDialogDescription>
            This adds {jarWords(jars)} back to the stock counts, so other customers can buy them.
            Only do this if the jars are still on your shelf and fit to sell. You can do it once
            per order.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11" onClick={() => setConfirm(false)}>
            Keep them off
          </AlertDialogCancel>
          <AlertDialogAction className="h-11" disabled={pending} onClick={put}>
            Put them back
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}
