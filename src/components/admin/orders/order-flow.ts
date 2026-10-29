/**
 * The rules for working an order in the admin: what each status is called,
 * which steps Jesse may take next, and how dates and times are shown.
 *
 * Both the pages and the server actions use these rules, so the buttons
 * Jesse sees and the checks the server makes always match.
 */

import type {
  DisputeStatus,
  FulfillmentType,
  Order,
  OrderAdminUpdate,
  OrderStatus,
  RefundStatus,
} from "@/types/orders";

/** The statuses an admin may move an order to. */
export type AdminMoveStatus =
  | "ready_for_pickup"
  | "out_for_delivery"
  | "shipped"
  | "fulfilled"
  | "cancelled";

/**
 * The steps an admin may take, by how the customer gets the order.
 *
 * - pickup:         paid -> ready_for_pickup -> fulfilled ("Picked up")
 * - local_delivery: paid -> out_for_delivery -> fulfilled ("Delivered")
 * - shipping:       paid -> shipped -> fulfilled ("Delivered")
 * - class:          paid -> fulfilled ("Attended")
 * - paid, ready_for_pickup and out_for_delivery orders can be cancelled.
 *   A shipped order can't: the jars are already with the carrier.
 * - A class booking is cancelled on the Class sessions page
 *   (/admin/classes), never here, so the refund rule for classes applies.
 *
 * Square, through the webhook, sets pending_payment, payment_failed and
 * paid. Admins never set those by hand, so paid appears here only as a
 * starting point. Refunds and disputes don't change the step (they have
 * their own fields), so a partly refunded or disputed order keeps its
 * buttons.
 */
export const ALLOWED_MOVES: Record<
  FulfillmentType,
  Partial<Record<OrderStatus, readonly AdminMoveStatus[]>>
> = {
  pickup: {
    paid: ["ready_for_pickup", "cancelled"],
    ready_for_pickup: ["fulfilled", "cancelled"],
  },
  local_delivery: {
    paid: ["out_for_delivery", "cancelled"],
    out_for_delivery: ["fulfilled", "cancelled"],
  },
  shipping: {
    paid: ["shipped", "cancelled"],
    shipped: ["fulfilled"],
  },
  class: {
    paid: ["fulfilled"],
  },
};

/** The time column each step fills in. */
export const MOVE_TIMESTAMP: Record<
  AdminMoveStatus,
  keyof Pick<
    OrderAdminUpdate,
    "ready_at" | "out_for_delivery_at" | "shipped_at" | "fulfilled_at" | "cancelled_at"
  >
> = {
  ready_for_pickup: "ready_at",
  out_for_delivery: "out_for_delivery_at",
  shipped: "shipped_at",
  fulfilled: "fulfilled_at",
  cancelled: "cancelled_at",
};

export function allowedMoves(
  type: FulfillmentType,
  status: OrderStatus
): readonly AdminMoveStatus[] {
  return ALLOWED_MOVES[type]?.[status] ?? [];
}

export function canMove(
  type: FulfillmentType,
  from: OrderStatus,
  to: string
): to is AdminMoveStatus {
  return (allowedMoves(type, from) as readonly string[]).includes(to);
}

/** The words on the button that takes an order to `to`. */
export function moveButtonLabel(
  to: AdminMoveStatus,
  type: FulfillmentType
): string {
  switch (to) {
    case "ready_for_pickup":
      return "Mark ready for pickup";
    case "out_for_delivery":
      return "Mark out for delivery";
    case "shipped":
      return "Mark shipped";
    case "fulfilled":
      if (type === "class") return "Mark attended";
      return type === "pickup" ? "Mark picked up" : "Mark delivered";
    case "cancelled":
      return "Cancel order";
  }
}

/**
 * The status in plain words. A fulfilled order reads "Completed". The order
 * page's history still says whether it was picked up or delivered.
 */
export function statusLabel(status: OrderStatus, type?: FulfillmentType): string {
  if (type === "class" && status === "paid") return "Booked";
  if (type === "class" && status === "fulfilled") return "Attended";
  switch (status) {
    case "pending_payment":
      return "Waiting for payment";
    case "payment_failed":
      return "Payment failed";
    case "paid":
      return "New, needs packing";
    case "ready_for_pickup":
      return "Ready for pickup";
    case "out_for_delivery":
      return "Out for delivery";
    case "shipped":
      return "Shipped";
    case "fulfilled":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

/** The refund in plain words, or null when nothing was refunded. */
export function refundLabel(status: RefundStatus): string | null {
  switch (status) {
    case "none":
      return null;
    case "partial":
      return "Partly refunded";
    case "full":
      return "Refunded";
  }
}

/** The card dispute in plain words, or null when there is none. */
export function disputeLabel(status: DisputeStatus | null): string | null {
  switch (status) {
    case "open":
      return "Card dispute";
    case "won":
      return "Dispute won";
    case "lost":
      return "Dispute lost";
    default:
      return null;
  }
}

/**
 * Badge colors for each status, picked to read on the dark admin. New orders
 * are solid orange and completed ones solid green, so both stand out.
 */
export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending_payment: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300",
  payment_failed: "border-red-500/50 bg-red-500/15 text-red-300",
  paid: "border-brand-orange bg-brand-orange text-white",
  ready_for_pickup: "border-sky-500/50 bg-sky-500/15 text-sky-300",
  out_for_delivery: "border-sky-500/50 bg-sky-500/15 text-sky-300",
  shipped: "border-violet-500/50 bg-violet-500/15 text-violet-300",
  fulfilled: "border-emerald-600 bg-emerald-600 text-white",
  cancelled: "border-zinc-500/50 bg-zinc-500/15 text-zinc-300",
};

export const REFUND_BADGE_CLASS = "border-amber-500/50 bg-amber-500/15 text-amber-300";

export const DISPUTE_BADGE_CLASS: Record<DisputeStatus, string> = {
  open: "border-red-500/50 bg-red-500/15 text-red-300",
  won: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  lost: "border-red-500/50 bg-red-500/15 text-red-300",
};

export function fulfillmentLabel(type: FulfillmentType): string {
  switch (type) {
    case "pickup":
      return "Pickup";
    case "local_delivery":
      return "Delivery";
    case "shipping":
      return "Shipping";
    case "class":
      return "Class";
  }
}

/**
 * Steps that still have a next step. A shipped order counts, because Jesse
 * still marks it delivered.
 */
export const OPEN_STATUSES = [
  "paid",
  "ready_for_pickup",
  "out_for_delivery",
  "shipped",
] as const satisfies readonly OrderStatus[];

/** The steps that mean the payment never went through. */
export const UNPAID_STATUSES = [
  "pending_payment",
  "payment_failed",
] as const satisfies readonly OrderStatus[];

type ViewRow = Pick<Order, "status" | "refund_status" | "dispute_status">;

/**
 * An order on the To do list: a step is left, and the money wasn't all
 * given back. A partly refunded or disputed order stays on the list.
 */
export function isOpenOrder(order: ViewRow): boolean {
  return (
    (OPEN_STATUSES as readonly OrderStatus[]).includes(order.status) &&
    order.refund_status !== "full"
  );
}

/** How many completed orders "To do" shows below the open ones. */
export const TODO_COMPLETED_LIMIT = 20;

/**
 * The tabs on the order list, picked with ?view= in the address. inView
 * says which orders each one shows.
 *
 * - To do: open orders (see isOpenOrder), then the newest completed ones.
 * - Completed: delivered or picked up.
 * - Cancelled and refunded: cancelled, or any money given back.
 * - Payment problems: never paid, or a card dispute.
 */
export const ORDER_VIEWS = [
  { key: "todo", label: "To do" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled and refunded" },
  { key: "problems", label: "Payment problems" },
  { key: "all", label: "All" },
] as const satisfies readonly { key: string; label: string }[];

export type OrderView = (typeof ORDER_VIEWS)[number];
export type OrderViewKey = OrderView["key"];

/** Whether an order belongs in a tab. order-data.ts asks the database the same thing. */
export function inView(key: OrderViewKey, order: ViewRow): boolean {
  switch (key) {
    case "todo":
      return isOpenOrder(order) || order.status === "fulfilled";
    case "completed":
      return order.status === "fulfilled";
    case "cancelled":
      return order.status === "cancelled" || order.refund_status !== "none";
    case "problems":
      return (
        (UNPAID_STATUSES as readonly OrderStatus[]).includes(order.status) ||
        order.dispute_status !== null
      );
    case "all":
      return true;
  }
}

/**
 * Puts "To do" in order: open orders first, then completed ones, each group
 * newest first. Keeps at most TODO_COMPLETED_LIMIT completed orders.
 */
export function arrangeTodo<T extends Pick<Order, "status" | "created_at">>(
  orders: readonly T[]
): T[] {
  const newestFirst = (a: T, b: T) => b.created_at.localeCompare(a.created_at);
  const open = orders.filter((o) => o.status !== "fulfilled").sort(newestFirst);
  const completed = orders
    .filter((o) => o.status === "fulfilled")
    .sort(newestFirst)
    .slice(0, TODO_COMPLETED_LIMIT);
  return [...open, ...completed];
}

/** The view named in the address, or "To do" when it is missing or unknown. */
export function findView(key: string | undefined): OrderView {
  return ORDER_VIEWS.find((v) => v.key === key) ?? ORDER_VIEWS[0];
}

/** The link to a view. "To do" is the plain list address. */
export function viewHref(key: OrderViewKey): string {
  return key === "todo" ? "/admin/orders" : `/admin/orders?view=${key}`;
}

const STORE_TIME_ZONE = "America/Denver";

/** "Oct 19, 2026, 2:05 PM" in Colorado time. */
export function formatOrderTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "Tue, Oct 21" for a YYYY-MM-DD date. Dates carry no time zone. */
export function formatDeliveryDate(date: string | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** The carriers offered in the tracking form. */
export const TRACKING_CARRIERS = ["USPS", "UPS", "FedEx", "Other"] as const;

/** A link to the carrier's tracking page, or null for other carriers. */
export function trackingUrl(
  carrier: string | null,
  number: string | null
): string | null {
  if (!number) return null;
  const n = encodeURIComponent(number);
  switch (carrier) {
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "UPS":
      return `https://www.ups.com/track?tracknum=${n}`;
    case "FedEx":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    default:
      return null;
  }
}

/** The order fields the list page shows. */
export type OrderListRow = Pick<
  Order,
  | "id"
  | "order_number"
  | "status"
  | "fulfillment_type"
  | "delivery_date"
  | "is_rush"
  | "customer_name"
  | "total_cents"
  | "created_at"
  | "square_environment"
  | "refund_status"
  | "dispute_status"
> & {
  /** Jars in the order, counting each jar of a repeated item. */
  item_count: number;
};
