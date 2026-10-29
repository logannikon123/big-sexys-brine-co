/**
 * Rows in the orders tables (supabase/migrations/20261020030648_orders_tables.sql).
 * Field names match the database columns. Money is in whole cents
 * (500 = $5.00) and the tax rate is in hundredths of a percent (400 = 4.00%).
 * Timestamps and dates arrive as ISO strings.
 *
 * Only admins can read these tables. Checkout and the Square webhook write
 * them with the service role key.
 */

import type { RefundFor } from "@/lib/tax-split";

/**
 * The order's step. Square sets pending_payment, payment_failed and paid;
 * Jesse sets the rest. Refunds and disputes live in their own fields, so
 * they never wipe out the step.
 */
export const ORDER_STATUSES = [
  "pending_payment",
  "payment_failed",
  "paid",
  "ready_for_pickup",
  "out_for_delivery",
  "shipped",
  "fulfilled",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** How much went back: worked out by the database from refunded_cents. */
export type RefundStatus = "none" | "partial" | "full";

/** Where a card dispute stands. Null on the order means no dispute. */
export type DisputeStatus = "open" | "won" | "lost";

/** "class" is a seat at the Learn to Preserve class (see src/types/classes.ts). */
export const FULFILLMENT_TYPES = ["pickup", "local_delivery", "shipping", "class"] as const;

export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export type SquareEnvironment = "sandbox" | "production";

export interface Order {
  id: string;
  order_number: number;
  /** Random code for the customer's order page link. */
  public_token: string;
  /** One per cart, so a repeated checkout finds the same order. */
  checkout_id: string;
  status: OrderStatus;

  fulfillment_type: FulfillmentType;
  /** YYYY-MM-DD */
  delivery_date: string | null;
  is_rush: boolean;
  pickup_instructions: string | null;

  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  customer_notes: string | null;
  admin_notes: string | null;

  geo_matched_address: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  geo_place_geoid: string | null;
  geo_place_name: string | null;
  geo_county_fips: string | null;
  /** Postgres numeric: Supabase may send it as a string. */
  delivery_miles: number | string | null;
  distance_method: string | null;

  subtotal_cents: number;
  delivery_fee_cents: number;
  rush_fee_cents: number;
  packing_fee_cents: number;
  shipping_postage_cents: number;
  /** Taken off before payment, by checkout only. */
  discount_cents: number;
  tax_cents: number;
  /** subtotal + delivery + rush + packing + postage + tax - discount */
  total_cents: number;
  /** Null when checkout had no local rate on file and charged 0%. */
  tax_rate_bps: number | null;
  tax_jurisdiction: string | null;
  /** Given back through Square, kept up to date by the webhook. */
  refunded_cents: number;
  /** Set by the database from refunded_cents and total_cents. */
  refund_status: RefundStatus;
  currency: string;

  square_order_id: string | null;
  square_payment_id: string | null;
  square_receipt_url: string | null;
  card_brand: string | null;
  card_last4: string | null;
  payment_error_code: string | null;
  square_environment: SquareEnvironment | null;

  dispute_status: DisputeStatus | null;
  square_dispute_id: string | null;
  disputed_at: string | null;
  dispute_closed_at: string | null;

  tracking_number: string | null;
  tracking_carrier: string | null;

  terms_accepted_at: string | null;
  terms_version: string | null;
  alerted_at: string | null;

  created_at: string;
  updated_at: string;
  paid_at: string | null;
  ready_at: string | null;
  out_for_delivery_at: string | null;
  shipped_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
}

/** The order columns an admin may change. The database refuses the rest. */
export type OrderAdminUpdate = Partial<
  Pick<
    Order,
    | "status"
    | "admin_notes"
    | "tracking_number"
    | "tracking_carrier"
    | "ready_at"
    | "out_for_delivery_at"
    | "shipped_at"
    | "fulfilled_at"
    | "cancelled_at"
  >
>;

export interface OrderItem {
  id: number;
  order_id: string;
  /** Null once the product is deleted. The copied fields below remain. */
  product_id: number | null;
  product_name: string;
  product_size: string | null;
  unit_price_cents: number;
  quantity: number;
  /** unit_price_cents * quantity */
  line_total_cents: number;
}

/** One refund, from Square's refund messages (or copied in from before). */
export interface OrderRefund {
  id: number;
  order_id: string;
  /** Null only on rows copied in from before refunds were saved one by one. */
  square_refund_id: string | null;
  square_payment_id: string | null;
  amount_cents: number;
  /** Square's word: PENDING, COMPLETED, REJECTED or FAILED. */
  status: string;
  reason: string | null;
  /**
   * The split into jars, fees and tax. The webhook fills it in for a refund
   * of the whole order; for a part refund it comes from Jesse's answer in
   * refund_for. Null until then, and for "unsure".
   */
  jars_cents: number | null;
  fees_cents: number | null;
  tax_cents: number | null;
  /** What a part refund was for, as Jesse answered. Null if not answered. */
  refund_for: RefundFor | null;
  source: "square" | "backfill";
  refunded_at: string;
  created_at: string;
  updated_at: string;
}

/** The emails sent to a customer after the receipt. */
export const ORDER_EMAIL_KINDS = [
  "ready_for_pickup",
  "out_for_delivery",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export type OrderEmailKind = (typeof ORDER_EMAIL_KINDS)[number];

export interface OrderEmail {
  id: number;
  order_id: string;
  kind: OrderEmailKind;
  /** Square's refund id for a refund email, empty for the rest. */
  event_key: string;
  created_at: string;
  sent_at: string | null;
  error: string | null;
}

export interface SquareWebhookEvent {
  event_id: string;
  event_type: string;
  received_at: string;
  processed_at: string | null;
  payload: unknown;
}

/** One city or county in an order's tax split (the order_tax_parts table). */
export interface OrderTaxPart {
  id: number;
  order_id: string;
  kind: "county" | "city" | "district";
  name: string;
  /** 'state', 'self' (the city collects its own) or null (no sales tax). */
  collected_by: "state" | "self" | null;
  rate_bps: number;
  taxable_cents: number;
  tax_cents: number;
}
