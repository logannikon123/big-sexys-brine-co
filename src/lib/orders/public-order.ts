import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { ClassBooking, ClassSession } from "@/types/classes";
import type { Order, OrderItem } from "@/types/orders";

/**
 * Loads one order for the customer's private order page (/order/[token]).
 *
 * Only admins can read the orders tables, so this reads with the service
 * role key. It picks only the columns the page shows: never the map
 * fields, the delivery miles, admin notes, Square ids or anything about
 * where deliveries start.
 */

const ORDER_COLUMNS = [
  "id",
  "order_number",
  "status",
  "fulfillment_type",
  "delivery_date",
  "is_rush",
  "pickup_instructions",
  "customer_name",
  "customer_email",
  "address_line1",
  "address_line2",
  "city",
  "state",
  "postal_code",
  "subtotal_cents",
  "delivery_fee_cents",
  "rush_fee_cents",
  "packing_fee_cents",
  "shipping_postage_cents",
  "discount_cents",
  "tax_cents",
  "total_cents",
  "tax_rate_bps",
  "tax_jurisdiction",
  "refunded_cents",
  "refund_status",
  "dispute_status",
  "square_receipt_url",
  "card_brand",
  "card_last4",
  "tracking_number",
  "tracking_carrier",
  "created_at",
] as const;

const ITEM_COLUMNS = [
  "id",
  "product_name",
  "product_size",
  "unit_price_cents",
  "quantity",
  "line_total_cents",
] as const;

type OrderRow = Pick<Order, (typeof ORDER_COLUMNS)[number]>;

export type PublicOrderItem = Pick<OrderItem, (typeof ITEM_COLUMNS)[number]>;

/** For a class order: the seats and the class date they are for. */
export type PublicClassBooking = Pick<ClassBooking, "seats" | "cancelled_at"> & {
  session: Pick<ClassSession, "starts_at" | "ends_at" | "location_name" | "location_address"> | null;
};

/** What the order page gets. The order's database id stays here. */
export type PublicOrder = Omit<OrderRow, "id"> & {
  items: PublicOrderItem[];
  /** Set only for class orders (fulfillment_type "class"). */
  classBooking: PublicClassBooking | null;
};

const CLASS_BOOKING_COLUMNS =
  "seats, cancelled_at, class_sessions(starts_at, ends_at, location_name, location_address)";

type ClassBookingRow = Pick<ClassBooking, "seats" | "cancelled_at"> & {
  // One session per booking. Supabase may send it as an object or a list of one.
  class_sessions: PublicClassBooking["session"] | NonNullable<PublicClassBooking["session"]>[];
};

/**
 * Checkout makes tokens of 48 lowercase hex characters. Allow a little room
 * either side, and turn away anything else before it reaches the database.
 */
const TOKEN_PATTERN = /^[0-9a-f]{32,128}$/;

export function isValidOrderToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** The order for this token, or null when the token is bad or unknown. */
export async function getPublicOrder(token: string): Promise<PublicOrder | null> {
  if (!isValidOrderToken(token)) return null;

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS.join(","))
    .eq("public_token", token)
    .maybeSingle();

  if (error) {
    console.error("Order page: could not load order", error.message);
    throw new Error("Could not load order");
  }
  if (!data) return null;
  const { id: orderId, ...order } = data as unknown as OrderRow;

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select(ITEM_COLUMNS.join(","))
    .eq("order_id", orderId)
    .order("id");

  if (itemsError) {
    console.error("Order page: could not load order items", itemsError.message);
    throw new Error("Could not load order items");
  }

  const classBooking = order.fulfillment_type === "class" ? await getClassBooking(orderId) : null;

  return { ...order, items: (items ?? []) as unknown as PublicOrderItem[], classBooking };
}

/**
 * The booking behind a class order. Read only for class orders, so jar
 * orders make the same queries as before. class_bookings.order_id is
 * unique, so there is at most one.
 */
async function getClassBooking(orderId: string): Promise<PublicClassBooking | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("class_bookings")
    .select(CLASS_BOOKING_COLUMNS)
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    console.error("Order page: could not load class booking", error.message);
    throw new Error("Could not load class booking");
  }
  if (!data) return null;
  const row = data as unknown as ClassBookingRow;
  const session = Array.isArray(row.class_sessions) ? (row.class_sessions[0] ?? null) : row.class_sessions;
  return { seats: row.seats, cancelled_at: row.cancelled_at, session };
}
