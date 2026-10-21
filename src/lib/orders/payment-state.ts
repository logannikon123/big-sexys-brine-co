/**
 * What a message from Square does to an order, worked out without touching
 * the database so the rules are easy to test. The Square webhook
 * (src/lib/square-webhook.ts) reads the order, asks planSquareChange what to
 * change, then saves it.
 *
 * The rule that matters most: a refund or a dispute never changes the
 * order's step. A partly refunded order can still be marked ready, shipped
 * or delivered, and a disputed one keeps its step and shows a warning.
 */

import type { DisputeStatus, Order, OrderStatus, RefundStatus } from "@/types/orders";

/** The order fields the rules read. */
export type OrderPaymentState = Pick<
  Order,
  "status" | "total_cents" | "refunded_cents" | "dispute_status"
>;

/** A Square message, boiled down to what the rules need. */
export type SquareChange =
  /** payment.created or payment.updated. refundedCents is Square's refunded total. */
  | { kind: "payment"; paymentStatus?: string; refundedCents: number }
  /** refund.created or refund.updated. refundedCents is the payment's refunded total. */
  | { kind: "refund"; refundStatus?: string; refundedCents: number }
  /** dispute.created or dispute.state.updated. */
  | { kind: "dispute"; disputeState?: string };

export interface PaymentPlan {
  /** A new step. Only an unpaid order's step ever changes here. */
  status?: OrderStatus;
  refunded_cents?: number;
  dispute_status?: DisputeStatus;
  /** The order just became paid: tell Jesse and send the receipt. */
  announcePaid: boolean;
  /** A refund went through: email the customer about it. */
  emailRefund: boolean;
}

/** The steps a payment message may still move: the order isn't paid yet. */
const UNPAID: readonly OrderStatus[] = ["pending_payment", "payment_failed"];

/** The same rule the database uses for orders.refund_status. */
export function refundStatusFor(refundedCents: number, totalCents: number): RefundStatus {
  if (refundedCents <= 0) return "none";
  return refundedCents >= totalCents ? "full" : "partial";
}

/**
 * Square's dispute states, in our three words. WON and INQUIRY_CLOSED (the
 * bank asked questions and let it go) keep the money. LOST and ACCEPTED
 * (Jesse gave in) lose it. Anything else is still open.
 */
export function disputeStatusFromSquare(state: string | undefined): DisputeStatus {
  switch (state) {
    case "WON":
    case "INQUIRY_CLOSED":
      return "won";
    case "LOST":
    case "ACCEPTED":
      return "lost";
    default:
      return "open";
  }
}

/**
 * Square's refunded total, kept within the order total. Messages can arrive
 * out of order, so a smaller total than the one on file is ignored.
 */
function newRefunded(order: OrderPaymentState, refundedCents: number): number | undefined {
  const capped = Math.min(Math.max(0, refundedCents), order.total_cents);
  return capped > order.refunded_cents ? capped : undefined;
}

export function planSquareChange(order: OrderPaymentState, change: SquareChange): PaymentPlan {
  const plan: PaymentPlan = { announcePaid: false, emailRefund: false };

  switch (change.kind) {
    case "payment": {
      if (change.paymentStatus === "COMPLETED" && UNPAID.includes(order.status)) {
        plan.status = "paid";
        plan.announcePaid = true;
      } else if (
        (change.paymentStatus === "FAILED" || change.paymentStatus === "CANCELED") &&
        order.status === "pending_payment"
      ) {
        plan.status = "payment_failed";
      }
      const refunded = newRefunded(order, change.refundedCents);
      if (refunded !== undefined) plan.refunded_cents = refunded;
      break;
    }
    case "refund": {
      if (change.refundStatus !== "COMPLETED") break;
      const refunded = newRefunded(order, change.refundedCents);
      if (refunded !== undefined) plan.refunded_cents = refunded;
      // The email log stops a second email for the same refund.
      plan.emailRefund = true;
      break;
    }
    case "dispute": {
      const next = disputeStatusFromSquare(change.disputeState);
      // A closed dispute never opens again. An "open" message that arrives
      // after the result is late, so it is ignored.
      const closed = order.dispute_status === "won" || order.dispute_status === "lost";
      if (!(closed && next === "open") && next !== order.dispute_status) {
        plan.dispute_status = next;
      }
      break;
    }
  }
  return plan;
}

/** The order after a plan is saved. Used by the tests. */
export function applyPlan<T extends OrderPaymentState>(order: T, plan: PaymentPlan): T {
  return {
    ...order,
    ...(plan.status ? { status: plan.status } : {}),
    ...(plan.refunded_cents !== undefined ? { refunded_cents: plan.refunded_cents } : {}),
    ...(plan.dispute_status ? { dispute_status: plan.dispute_status } : {}),
  };
}

/** The order's money parts that a refund can be split into. */
export type RefundSplitOrder = Pick<
  Order,
  | "subtotal_cents"
  | "delivery_fee_cents"
  | "rush_fee_cents"
  | "packing_fee_cents"
  | "shipping_postage_cents"
  | "discount_cents"
  | "tax_cents"
  | "total_cents"
>;

export interface RefundSplit {
  jars_cents: number;
  fees_cents: number;
  tax_cents: number;
}

/**
 * How a refund splits into jars, fees and tax, or null when we can't be
 * sure. Square refunds an amount, not a list of items, so a part refund
 * might be a waived fee (no tax) or a broken jar (with tax). Only a single
 * refund of the whole order is certain: it is the order's own parts.
 */
export function refundSplit(order: RefundSplitOrder, amountCents: number): RefundSplit | null {
  if (amountCents <= 0 || amountCents !== order.total_cents || order.discount_cents !== 0) {
    return null;
  }
  return {
    jars_cents: order.subtotal_cents,
    fees_cents:
      order.delivery_fee_cents +
      order.rush_fee_cents +
      order.packing_fee_cents +
      order.shipping_postage_cents,
    tax_cents: order.tax_cents,
  };
}
