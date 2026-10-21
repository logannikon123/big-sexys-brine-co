import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DISPUTE_BADGE_CLASS,
  REFUND_BADGE_CLASS,
  STATUS_BADGE_CLASS,
  disputeLabel,
  refundLabel,
  statusLabel,
} from "./order-flow";
import type { DisputeStatus, OrderStatus, RefundStatus } from "@/types/orders";

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs", STATUS_BADGE_CLASS[status], className)}
    >
      {statusLabel(status)}
    </Badge>
  );
}

/**
 * Refund and dispute badges, shown beside the step. Nothing shows when
 * nothing was refunded and there is no dispute.
 */
export function OrderMoneyBadges({
  refundStatus,
  disputeStatus,
  className,
}: {
  refundStatus: RefundStatus;
  disputeStatus: DisputeStatus | null;
  className?: string;
}) {
  const refund = refundLabel(refundStatus);
  const dispute = disputeLabel(disputeStatus);
  return (
    <>
      {refund && (
        <Badge variant="outline" className={cn("text-xs", REFUND_BADGE_CLASS, className)}>
          {refund}
        </Badge>
      )}
      {dispute && disputeStatus && (
        <Badge
          variant="outline"
          className={cn("text-xs", DISPUTE_BADGE_CLASS[disputeStatus], className)}
        >
          {dispute}
        </Badge>
      )}
    </>
  );
}

export function RushBadge() {
  return (
    <Badge
      variant="outline"
      className="border-red-500/60 bg-red-500/15 text-red-300"
    >
      Rush
    </Badge>
  );
}

/** Shown on orders paid with Square's test system, which moves no money. */
export function SandboxBadge() {
  return (
    <Badge
      variant="outline"
      className="border-yellow-500/60 bg-yellow-500/15 text-yellow-300"
    >
      Test (sandbox)
    </Badge>
  );
}

/** The yellow strip at the top of each order page in demo mode. */
export function DemoBanner() {
  return (
    <div
      role="status"
      className="rounded-md border border-yellow-500/60 bg-yellow-400 px-4 py-3 text-sm font-medium text-black"
    >
      Demo data. These orders are made up so you can see how the pages look.
      Nothing you click here is saved.
    </div>
  );
}
