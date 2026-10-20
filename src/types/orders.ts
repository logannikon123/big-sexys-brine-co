/**
 * Rows in the orders tables (supabase/migrations/20261020030648_orders_tables.sql).
 * Field names match the database columns. Money is in whole cents
 * (500 = $5.00) and the tax rate is in hundredths of a percent (400 = 4.00%).
 * Timestamps and dates arrive as ISO strings.
 *
 * Only admins can read these tables. Checkout and the Square webhook write
 * them with the service role key.
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
  "refunded",
  "partially_refunded",
  "disputed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENT_TYPES = ["pickup", "local_delivery", "shipping"] as const;

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
  tax_rate_bps: number | null;
  tax_jurisdiction: string | null;
  /** Given back through Square, kept up to date by the webhook. */
  refunded_cents: number;
  currency: string;

  square_order_id: string | null;
  square_payment_id: string | null;
  square_receipt_url: string | null;
  card_brand: string | null;
  card_last4: string | null;
  payment_error_code: string | null;
  square_environment: SquareEnvironment | null;

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

export interface SquareWebhookEvent {
  event_id: string;
  event_type: string;
  received_at: string;
  processed_at: string | null;
  payload: unknown;
}
