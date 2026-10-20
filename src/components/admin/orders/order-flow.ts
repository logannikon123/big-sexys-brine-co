/**
 * The rules for working an order in the admin: what each status is called,
 * which steps Jesse may take next, and how dates and times are shown.
 *
 * Both the pages and the server actions use these rules, so the buttons
 * Jesse sees and the checks the server makes always match.
 */

import type {
  FulfillmentType,
  Order,
  OrderAdminUpdate,
  OrderStatus,
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
 * - any open order can be cancelled.
 *
 * Square, through the webhook, sets paid, payment_failed, refunded,
 * partially_refunded and disputed. Admins never set those by hand, so they
 * appear here only as starting points, never as a next step.
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
    shipped: ["fulfilled", "cancelled"],
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
      return type === "pickup" ? "Mark picked up" : "Mark delivered";
    case "cancelled":
      return "Cancel order";
  }
}

/** The status in plain words. A fulfilled pickup reads "Picked up". */
export function statusLabel(status: OrderStatus, type?: FulfillmentType): string {
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
      return type === "pickup" ? "Picked up" : "Delivered";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    case "partially_refunded":
      return "Partly refunded";
    case "disputed":
      return "Card dispute";
  }
}

/** Badge colors for each status, picked to read on the dark admin. */
export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending_payment: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300",
  payment_failed: "border-red-500/50 bg-red-500/15 text-red-300",
  paid: "border-brand-orange bg-brand-orange text-white",
  ready_for_pickup: "border-sky-500/50 bg-sky-500/15 text-sky-300",
  out_for_delivery: "border-sky-500/50 bg-sky-500/15 text-sky-300",
  shipped: "border-violet-500/50 bg-violet-500/15 text-violet-300",
  fulfilled: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  cancelled: "border-zinc-500/50 bg-zinc-500/15 text-zinc-300",
  refunded: "border-amber-500/50 bg-amber-500/15 text-amber-300",
  partially_refunded: "border-amber-500/50 bg-amber-500/15 text-amber-300",
  disputed: "border-red-500/50 bg-red-500/15 text-red-300",
};

export function fulfillmentLabel(type: FulfillmentType): string {
  switch (type) {
    case "pickup":
      return "Pickup";
    case "local_delivery":
      return "Delivery";
    case "shipping":
      return "Shipping";
  }
}

/** The tabs on the order list, picked with ?view= in the address. */
export const ORDER_VIEWS = [
  {
    key: "todo",
    label: "To do",
    statuses: ["paid", "ready_for_pickup", "out_for_delivery"],
  },
  { key: "done", label: "Done", statuses: ["shipped", "fulfilled"] },
  {
    key: "cancelled",
    label: "Cancelled and refunded",
    statuses: ["cancelled", "refunded", "partially_refunded", "disputed"],
  },
  {
    key: "problems",
    label: "Payment problems",
    statuses: ["pending_payment", "payment_failed"],
  },
  { key: "all", label: "All", statuses: null },
] as const satisfies readonly {
  key: string;
  label: string;
  statuses: readonly OrderStatus[] | null;
}[];

export type OrderView = (typeof ORDER_VIEWS)[number];
export type OrderViewKey = OrderView["key"];

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
> & {
  /** Jars in the order, counting each jar of a repeated item. */
  item_count: number;
};
