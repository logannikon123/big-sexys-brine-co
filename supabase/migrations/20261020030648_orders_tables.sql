-- Tables for online orders (online ordering, step 5).
--
-- orders:                one row for each checkout, paid or not
-- order_items:           the jars in each order, copied at checkout time
-- square_webhook_events: every message Square sends us, saved once so a
--                        repeated message is not handled twice
--
-- Money is in whole cents (500 = $5.00) and the tax rate is in hundredths of
-- a percent (400 = 4.00%). Names, sizes, prices, fees and pickup
-- instructions are copied into the order, so later changes to a product or
-- to the store settings never change an old order.
--
-- These tables hold customers' names, emails, phone numbers and addresses.
-- Signed-out visitors get no access at all. Signed-in accounts that are not
-- admins can't read or change anything, because every rule below asks
-- public.is_admin(). Admins can read all three tables and can change only a
-- short list of order columns (see the end of this file). Checkout and the
-- Square webhook will write with the service role key, which skips these
-- rules, so there are no insert or delete rules.

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The number Jesse and the customer see: 1001, 1002, ...
  order_number INTEGER GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,
  -- A long random code for the customer's order page link. Hard to guess,
  -- unlike the order number.
  public_token TEXT UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  -- One per cart. If checkout runs twice for the same cart, the second try
  -- finds this order instead of making another.
  checkout_id UUID UNIQUE NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'payment_failed', 'paid', 'ready_for_pickup',
    'out_for_delivery', 'shipped', 'fulfilled', 'cancelled', 'refunded',
    'partially_refunded', 'disputed'
  )),

  -- Fulfillment
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('pickup', 'local_delivery', 'shipping')),
  delivery_date DATE,
  is_rush BOOLEAN NOT NULL DEFAULT false,
  pickup_instructions TEXT,

  -- Customer
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  customer_notes TEXT,
  admin_notes TEXT,

  -- Where the address is, from the US Census geocoder, and how far it is
  -- from the delivery starting point. Used for the delivery fee and for
  -- sales tax.
  geo_matched_address TEXT,
  geo_lat DOUBLE PRECISION,
  geo_lon DOUBLE PRECISION,
  geo_place_geoid TEXT,
  geo_place_name TEXT,
  geo_county_fips TEXT,
  delivery_miles NUMERIC(6,2) CHECK (delivery_miles >= 0),
  distance_method TEXT,

  -- Money, in cents
  subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  rush_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (rush_fee_cents >= 0),
  packing_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (packing_fee_cents >= 0),
  shipping_postage_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_postage_cents >= 0),
  -- Money taken off before the customer pays. Set by checkout only. A fee
  -- waived after payment is a partial refund in Square instead, recorded in
  -- refunded_cents.
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  tax_rate_bps INTEGER CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 10000),
  tax_jurisdiction TEXT,
  -- Money given back through Square, kept up to date by the webhook.
  refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Square
  square_order_id TEXT UNIQUE,
  square_payment_id TEXT UNIQUE,
  square_receipt_url TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  payment_error_code TEXT,
  square_environment TEXT CHECK (square_environment IN ('sandbox', 'production')),

  -- Shipping
  tracking_number TEXT,
  tracking_carrier TEXT DEFAULT 'USPS',

  -- When the customer agreed to the store terms, and which version.
  terms_accepted_at TIMESTAMPTZ,
  terms_version TEXT,
  -- When Jesse was told about the new order.
  alerted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- The parts must add up to the total.
  CONSTRAINT orders_total_adds_up CHECK (
    total_cents = subtotal_cents + delivery_fee_cents + rush_fee_cents
      + packing_fee_cents + shipping_postage_cents + tax_cents - discount_cents
  ),
  -- Square can't give back more than was paid.
  CONSTRAINT orders_refund_not_over_total CHECK (refunded_cents <= total_cents)
);

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- For the admin order list: newest first, and newest first within a status.
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- A link to the product while it exists. If the product is deleted the
  -- link is cleared, and the copied name, size and price still show what
  -- was bought.
  product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_size TEXT,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL,
  CONSTRAINT order_items_line_total_adds_up CHECK (line_total_cents = unit_price_cents * quantity)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);

CREATE TABLE IF NOT EXISTS public.square_webhook_events (
  -- Square's own id for the message. The webhook saves it first, so a
  -- repeat of the same message fails to save and is skipped.
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  payload JSONB
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_webhook_events ENABLE ROW LEVEL SECURITY;

-- Table rights. Supabase gives signed-out (anon) and signed-in
-- (authenticated) users every right on a new table. Take them all away,
-- then give signed-in users back reading, and on orders the right to change
-- a few columns. The rules below then limit both to admins. The service
-- role keeps every right.
REVOKE ALL ON public.orders, public.order_items, public.square_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.orders, public.order_items, public.square_webhook_events TO authenticated;

-- The columns an admin may change while working an order. Everything else,
-- including the money, the customer's details and the Square fields, is set
-- by checkout or by the webhook only.
GRANT UPDATE (
  status, admin_notes, tracking_number, tracking_carrier,
  ready_at, out_for_delivery_at, shipped_at, fulfilled_at, cancelled_at
) ON public.orders TO authenticated;

-- The counters behind order_number and order_items.id. Only the service
-- role, which adds the rows, needs them.
REVOKE ALL ON SEQUENCE public.orders_order_number_seq, public.order_items_id_seq FROM anon, authenticated;

-- Rules: admins only.
DROP POLICY IF EXISTS "Admin read orders" ON public.orders;
DROP POLICY IF EXISTS "Admin update orders" ON public.orders;
DROP POLICY IF EXISTS "Admin read order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admin read square_webhook_events" ON public.square_webhook_events;
CREATE POLICY "Admin read orders" ON public.orders FOR SELECT TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin update orders" ON public.orders FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin read order_items" ON public.order_items FOR SELECT TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin read square_webhook_events" ON public.square_webhook_events FOR SELECT TO authenticated
  USING ((select public.is_admin()));
