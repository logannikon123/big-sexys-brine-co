/**
 * Made-up orders for previewing the order pages on a local computer before
 * any real order exists. The names, emails, phone numbers and street
 * addresses are fake.
 *
 * The pages load this file only when isOrdersDemo() in order-data.ts says
 * so, which never happens on the live site.
 */

import type { Order, OrderItem } from "@/types/orders";

type DemoOrder = { order: Order; items: OrderItem[] };

/** The fields every demo order shares. Each order below fills in the rest. */
const blank: Omit<
  Order,
  | "id"
  | "order_number"
  | "status"
  | "fulfillment_type"
  | "customer_name"
  | "customer_email"
  | "subtotal_cents"
  | "total_cents"
  | "created_at"
> = {
  public_token: "demo-token",
  checkout_id: "00000000-0000-4000-8000-000000000000",
  delivery_date: null,
  is_rush: false,
  pickup_instructions: null,
  customer_phone: null,
  address_line1: null,
  address_line2: null,
  city: null,
  state: null,
  postal_code: null,
  customer_notes: null,
  admin_notes: null,
  geo_matched_address: null,
  geo_lat: null,
  geo_lon: null,
  geo_place_geoid: null,
  geo_place_name: null,
  geo_county_fips: null,
  delivery_miles: null,
  distance_method: null,
  delivery_fee_cents: 0,
  rush_fee_cents: 0,
  packing_fee_cents: 0,
  shipping_postage_cents: 0,
  discount_cents: 0,
  tax_cents: 0,
  tax_rate_bps: null,
  tax_jurisdiction: null,
  refunded_cents: 0,
  currency: "USD",
  square_order_id: null,
  square_payment_id: null,
  square_receipt_url: null,
  card_brand: "VISA",
  card_last4: "1111",
  payment_error_code: null,
  square_environment: "sandbox",
  tracking_number: null,
  tracking_carrier: null,
  terms_accepted_at: null,
  terms_version: "2026-10",
  alerted_at: null,
  updated_at: "2026-10-19T15:00:00Z",
  paid_at: null,
  ready_at: null,
  out_for_delivery_at: null,
  shipped_at: null,
  fulfilled_at: null,
  cancelled_at: null,
};

function item(
  id: number,
  orderId: string,
  name: string,
  size: string,
  unitPriceCents: number,
  quantity: number
): OrderItem {
  return {
    id,
    order_id: orderId,
    product_id: null,
    product_name: name,
    product_size: size,
    unit_price_cents: unitPriceCents,
    quantity,
    line_total_cents: unitPriceCents * quantity,
  };
}

export const DEMO_ORDERS: DemoOrder[] = [
  // Pickup, paid, waiting to be packed.
  {
    order: {
      ...blank,
      id: "demo-1004",
      order_number: 1004,
      status: "paid",
      fulfillment_type: "pickup",
      delivery_date: "2026-10-22",
      pickup_instructions:
        "Pick up at the side door. Text when you get here and we will bring your jars out.",
      customer_name: "Pat Example",
      customer_email: "pat@example.com",
      customer_phone: "555-0100",
      customer_notes: "Can I grab these after 5?",
      subtotal_cents: 3000,
      tax_rate_bps: 750,
      tax_jurisdiction: "Lakewood, CO",
      tax_cents: 225,
      total_cents: 3225,
      created_at: "2026-10-19T14:05:00Z",
      paid_at: "2026-10-19T14:05:30Z",
      terms_accepted_at: "2026-10-19T14:04:10Z",
    },
    items: [item(1, "demo-1004", "Spicy Dill Pickles", "16oz", 1500, 2)],
  },
  // Local delivery with rush, paid.
  {
    order: {
      ...blank,
      id: "demo-1003",
      order_number: 1003,
      status: "paid",
      fulfillment_type: "local_delivery",
      delivery_date: "2026-10-20",
      is_rush: true,
      customer_name: "Sam Sample",
      customer_email: "sam@example.com",
      customer_phone: "555-0101",
      address_line1: "123 Example St",
      address_line2: "Apt 4",
      city: "Lakewood",
      state: "CO",
      postal_code: "80226",
      delivery_miles: "6.4",
      subtotal_cents: 4200,
      delivery_fee_cents: 800,
      rush_fee_cents: 1000,
      tax_rate_bps: 750,
      tax_jurisdiction: "Lakewood, CO",
      tax_cents: 315,
      total_cents: 6315,
      created_at: "2026-10-19T03:40:00Z",
      paid_at: "2026-10-19T03:40:40Z",
      terms_accepted_at: "2026-10-19T03:39:00Z",
    },
    items: [
      item(2, "demo-1003", "Spicy Dill Pickles", "16oz", 1500, 2),
      item(3, "demo-1003", "Pickled Red Onions", "8oz", 1200, 1),
    ],
  },
  // Shipping, shipped with a tracking number.
  {
    order: {
      ...blank,
      id: "demo-1002",
      order_number: 1002,
      status: "shipped",
      fulfillment_type: "shipping",
      customer_name: "Casey Test",
      customer_email: "casey@example.com",
      customer_phone: "555-0102",
      address_line1: "456 Sample Ave",
      city: "Grand Junction",
      state: "CO",
      postal_code: "81501",
      admin_notes: "Packed with extra bubble wrap.",
      subtotal_cents: 2700,
      packing_fee_cents: 300,
      shipping_postage_cents: 1250,
      tax_rate_bps: 290,
      tax_jurisdiction: "Colorado",
      tax_cents: 78,
      total_cents: 4328,
      square_environment: "production",
      card_brand: "MASTERCARD",
      card_last4: "4444",
      square_receipt_url: "https://example.com/demo-receipt",
      tracking_number: "9400100000000000000000",
      tracking_carrier: "USPS",
      created_at: "2026-10-17T19:15:00Z",
      paid_at: "2026-10-17T19:15:20Z",
      shipped_at: "2026-10-18T16:00:00Z",
      terms_accepted_at: "2026-10-17T19:14:00Z",
    },
    items: [
      item(4, "demo-1002", "Spicy Dill Pickles", "16oz", 1500, 1),
      item(5, "demo-1002", "Bread and Butter Chips", "16oz", 1200, 1),
    ],
  },
  // Local delivery, cancelled and refunded in Square.
  {
    order: {
      ...blank,
      id: "demo-1001",
      order_number: 1001,
      status: "cancelled",
      fulfillment_type: "local_delivery",
      delivery_date: "2026-10-16",
      customer_name: "Jordan Placeholder",
      customer_email: "jordan@example.com",
      customer_phone: "555-0103",
      address_line1: "789 Demo Rd",
      city: "Denver",
      state: "CO",
      postal_code: "80204",
      delivery_miles: "4.1",
      admin_notes: "Customer asked to cancel. Refunded in Square.",
      subtotal_cents: 1500,
      delivery_fee_cents: 500,
      tax_rate_bps: 750,
      tax_jurisdiction: "Denver, CO",
      tax_cents: 113,
      total_cents: 2113,
      refunded_cents: 2113,
      created_at: "2026-10-15T17:30:00Z",
      paid_at: "2026-10-15T17:30:25Z",
      cancelled_at: "2026-10-15T20:00:00Z",
      terms_accepted_at: "2026-10-15T17:29:00Z",
    },
    items: [item(6, "demo-1001", "Spicy Dill Pickles", "16oz", 1500, 1)],
  },
];
