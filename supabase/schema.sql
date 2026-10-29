-- Big Sexy's Brine Co. — Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  size TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  heat INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Signature',
  image_url TEXT,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  sold_online BOOLEAN NOT NULL DEFAULT FALSE,
  sold_out BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_online_needs_price CHECK (NOT sold_online OR price_cents IS NOT NULL)
);

-- Product-Categories junction table (many-to-many)
CREATE TABLE IF NOT EXISTS product_categories (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_day TEXT,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  type TEXT NOT NULL CHECK (type IN ('market', 'festival', 'pop-up', 'class')),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Retail locations: stores that carry the jars, shown on the Find Us page
-- above the events (see supabase/migrations/20261021204139_retail_locations.sql).
CREATE TABLE IF NOT EXISTS retail_locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  address TEXT NOT NULL CHECK (btrim(address) <> ''),
  hours TEXT,
  image_url TEXT,
  is_pickup_location BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id SERIAL PRIMARY KEY,
  quote TEXT NOT NULL,
  author TEXT NOT NULL,
  product TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Class info table (single row)
CREATE TABLE IF NOT EXISTS class_info (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  duration TEXT NOT NULL,
  description TEXT NOT NULL,
  what_you_learn TEXT[] NOT NULL DEFAULT '{}',
  what_you_get TEXT[] NOT NULL DEFAULT '{}',
  max_students INTEGER NOT NULL DEFAULT 12
);

-- Gallery images table
CREATE TABLE IF NOT EXISTS gallery_images (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product images table (multi-image gallery per product)
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contest entries table (written by /api/contest with the service role key)
CREATE TABLE IF NOT EXISTS contest_entries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  pun TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Store settings for online ordering (single row; see
-- supabase/migrations/20261020010748_store_settings.sql and
-- 20261020023156_distance_delivery.sql). Money in cents, weights in ounces,
-- box sizes in inches, distances in miles, tax rate in hundredths of a percent.
CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Master switch
  orders_open BOOLEAN NOT NULL DEFAULT false,

  -- Pickup
  pickup_enabled BOOLEAN NOT NULL DEFAULT true,
  pickup_instructions TEXT NOT NULL DEFAULT '',

  -- Local delivery, priced by one-way driving distance from the starting
  -- point in store_private_settings: delivery_fee_per_step_cents for each
  -- started delivery_step_miles, up to delivery_max_miles. A date sooner than
  -- delivery_standard_hours adds rush_fee_cents. Free delivery (when on)
  -- needs both conditions and waives the distance fee only.
  delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  delivery_min_order_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_min_order_cents >= 0),
  delivery_instructions TEXT NOT NULL DEFAULT '',
  delivery_max_miles NUMERIC(5,1) NOT NULL DEFAULT 24 CHECK (delivery_max_miles > 0),
  delivery_step_miles NUMERIC(5,1) NOT NULL DEFAULT 6 CHECK (delivery_step_miles > 0),
  delivery_fee_per_step_cents INTEGER NOT NULL DEFAULT 500 CHECK (delivery_fee_per_step_cents >= 0),
  delivery_standard_hours INTEGER NOT NULL DEFAULT 72 CHECK (delivery_standard_hours > 0),
  rush_fee_cents INTEGER NOT NULL DEFAULT 1500 CHECK (rush_fee_cents >= 0),
  free_delivery_enabled BOOLEAN NOT NULL DEFAULT false,
  free_delivery_max_miles NUMERIC(5,1) CHECK (free_delivery_max_miles > 0),
  free_delivery_min_order_cents INTEGER CHECK (free_delivery_min_order_cents >= 0),

  -- Shipping
  shipping_enabled BOOLEAN NOT NULL DEFAULT true,
  shipping_states TEXT[] NOT NULL DEFAULT '{CO}'
    CHECK (array_position(shipping_states, NULL) IS NULL
    AND array_to_string(shipping_states, ',') ~ '^([A-Z]{2}(,[A-Z]{2})*)?$'),
  ship_from_zip TEXT NOT NULL DEFAULT '80214'
    CHECK (ship_from_zip = '' OR ship_from_zip ~ '^[0-9]{5}$'),
  shipping_service TEXT NOT NULL DEFAULT 'ground_advantage'
    CHECK (shipping_service IN ('ground_advantage', 'priority')),
  jars_per_box INTEGER NOT NULL DEFAULT 3 CHECK (jars_per_box > 0),
  packing_fee_per_box_cents INTEGER NOT NULL DEFAULT 1000 CHECK (packing_fee_per_box_cents >= 0),
  box_length_in NUMERIC(5,2) NOT NULL DEFAULT 14.5 CHECK (box_length_in > 0),
  box_width_in NUMERIC(5,2) NOT NULL DEFAULT 6.5 CHECK (box_width_in > 0),
  box_height_in NUMERIC(5,2) NOT NULL DEFAULT 7 CHECK (box_height_in > 0),
  empty_box_weight_oz INTEGER NOT NULL DEFAULT 32 CHECK (empty_box_weight_oz >= 0),
  jar_weight_16oz_oz INTEGER NOT NULL DEFAULT 32 CHECK (jar_weight_16oz_oz >= 0),
  jar_weight_32oz_oz INTEGER NOT NULL DEFAULT 48 CHECK (jar_weight_32oz_oz >= 0),
  shipping_cushion_per_box_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cushion_per_box_cents >= 0),
  shipping_fallback_per_box_cents INTEGER NOT NULL DEFAULT 1500 CHECK (shipping_fallback_per_box_cents >= 0),

  -- Sales tax
  tax_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 10000),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Private store settings (single row, admins only; see
-- supabase/migrations/20261020023156_distance_delivery.sql). Holds the
-- delivery starting point, which is the owner's home address, so the public
-- must never read it.
CREATE TABLE IF NOT EXISTS store_private_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  delivery_origin_address TEXT NOT NULL DEFAULT '',
  delivery_origin_lat DOUBLE PRECISION,
  delivery_origin_lon DOUBLE PRECISION,
  delivery_origin_matched_address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Online orders (see supabase/migrations/20261020030648_orders_tables.sql).
-- One row for each checkout, paid or not. Money in cents, tax rate in
-- hundredths of a percent. Names, prices, fees and pickup instructions are
-- copied in at checkout so later edits never change an old order. Holds
-- customers' personal details: admins only. Checkout and the Square webhook
-- write with the service role key. status is only the delivery step;
-- refunds and card disputes have their own columns, so they never wipe it
-- out (see supabase/migrations/20261021212638_order_refunds_disputes_emails.sql).
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number INTEGER GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,
  public_token TEXT UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  checkout_id UUID UNIQUE NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending_payment' CONSTRAINT orders_status_check CHECK (status IN (
    'pending_payment', 'payment_failed', 'paid', 'ready_for_pickup',
    'out_for_delivery', 'shipped', 'fulfilled', 'cancelled'
  )),

  -- Fulfillment
  -- 'class' is a seat at the Learn to Preserve class (see class_bookings below).
  fulfillment_type TEXT NOT NULL CONSTRAINT orders_fulfillment_type_check
    CHECK (fulfillment_type IN ('pickup', 'local_delivery', 'shipping', 'class')),
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

  -- Geocoder match and distance, for the delivery fee and sales tax
  geo_matched_address TEXT,
  geo_lat DOUBLE PRECISION,
  geo_lon DOUBLE PRECISION,
  geo_place_geoid TEXT,
  geo_place_name TEXT,
  geo_county_fips TEXT,
  delivery_miles NUMERIC(6,2) CHECK (delivery_miles >= 0),
  distance_method TEXT,

  -- Money, in cents. discount_cents is set by checkout only; a fee waived
  -- after payment is a partial refund in Square, recorded in refunded_cents.
  subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  rush_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (rush_fee_cents >= 0),
  packing_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (packing_fee_cents >= 0),
  shipping_postage_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_postage_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  tax_rate_bps INTEGER CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 10000),
  tax_jurisdiction TEXT,
  refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  -- Worked out from refunded_cents: 'none', 'partial' or 'full'.
  refund_status TEXT GENERATED ALWAYS AS (
    CASE
      WHEN refunded_cents <= 0 THEN 'none'
      WHEN refunded_cents >= total_cents THEN 'full'
      ELSE 'partial'
    END
  ) STORED,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Square
  square_order_id TEXT UNIQUE,
  square_payment_id TEXT UNIQUE,
  square_receipt_url TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  payment_error_code TEXT,
  square_environment TEXT CHECK (square_environment IN ('sandbox', 'production')),

  -- Card dispute, from Square's dispute messages. NULL means none.
  dispute_status TEXT CHECK (dispute_status IN ('open', 'won', 'lost')),
  square_dispute_id TEXT,
  disputed_at TIMESTAMPTZ,
  dispute_closed_at TIMESTAMPTZ,

  -- Shipping
  tracking_number TEXT,
  tracking_carrier TEXT DEFAULT 'USPS',

  -- Consent and new-order alert
  terms_accepted_at TIMESTAMPTZ,
  terms_version TEXT,
  alerted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  CONSTRAINT orders_total_adds_up CHECK (
    total_cents = subtotal_cents + delivery_fee_cents + rush_fee_cents
      + packing_fee_cents + shipping_postage_cents + tax_cents - discount_cents
  ),
  CONSTRAINT orders_refund_not_over_total CHECK (refunded_cents <= total_cents)
);

-- The jars in each order, copied at checkout. product_id is cleared if the
-- product is deleted; the copied name, size and price remain.
CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_size TEXT,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL,
  CONSTRAINT order_items_line_total_adds_up CHECK (line_total_cents = unit_price_cents * quantity)
);

-- Every message Square sends, saved by its id so a repeat is skipped.
CREATE TABLE IF NOT EXISTS square_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  payload JSONB
);

-- One row for each refund Square tells us about. square_refund_id is empty
-- only on 'backfill' rows, copied in for refunds made before this table.
-- The webhook fills in the jars, fees and tax split only when certain (a
-- single refund of the whole order). For a part refund, Jesse says on the
-- admin order page what it was for (refund_for), and the site works out the
-- split from that (see supabase/migrations/20261022010406_refund_reasons.sql).
-- 'unsure', or no answer yet, leaves the split empty.
CREATE TABLE IF NOT EXISTS order_refunds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  square_refund_id TEXT UNIQUE,
  square_payment_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL,
  reason TEXT,
  jars_cents INTEGER CHECK (jars_cents >= 0),
  fees_cents INTEGER CHECK (fees_cents >= 0),
  tax_cents INTEGER CHECK (tax_cents >= 0),
  refund_for TEXT CHECK (refund_for IN ('fees', 'jars', 'both', 'unsure')),
  source TEXT NOT NULL DEFAULT 'square' CHECK (source IN ('square', 'backfill')),
  refunded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_refunds_parts_add_up CHECK (
    (jars_cents IS NULL AND fees_cents IS NULL AND tax_cents IS NULL)
    OR (jars_cents + fees_cents + tax_cents = amount_cents)
  ),
  CONSTRAINT order_refunds_answer_matches_split CHECK (
    refund_for IS NULL OR ((refund_for = 'unsure') = (jars_cents IS NULL))
  )
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order_id ON order_refunds (order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_refunded_at ON order_refunds (refunded_at);

-- One row for each email sent to a customer after the receipt. The unique
-- key stops the same email going out twice. event_key is Square's refund id
-- for a refund email, empty for the rest.
CREATE TABLE IF NOT EXISTS order_emails (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'ready_for_pickup', 'out_for_delivery', 'shipped', 'delivered',
    'cancelled', 'refunded'
  )),
  event_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error TEXT,
  CONSTRAINT order_emails_once UNIQUE (order_id, kind, event_key)
);

-- Local sales tax rates on food, one row for each county, city or special
-- district (see supabase/migrations/20261020050717_food_tax_rates.sql).
-- census_geoid is the Census code: 5 digits for a county, 7 for a city, NULL
-- for a district. Rate in hundredths of a percent, 0 when food is exempt.
-- Checkout charges tax only from rows an admin has marked confirmed.
-- collected_by says who collects the tax: 'state' (Colorado Department of
-- Revenue), 'self' (a home-rule city, or Denver or Broomfield) or NULL for a
-- place with no sales tax. Rows for all 64 counties and most cities arrive in
-- supabase/migrations/20261021193135_statewide_food_tax_rates.sql.
CREATE TABLE IF NOT EXISTS food_tax_rates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('county', 'city', 'district')),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  census_geoid TEXT UNIQUE,
  taxes_food BOOLEAN NOT NULL,
  food_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (food_rate_bps BETWEEN 0 AND 10000),
  confirmed BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_by TEXT CONSTRAINT food_tax_rates_collected_by_check
    CHECK (collected_by IN ('state', 'self')),
  CONSTRAINT food_tax_rates_kind_name_key UNIQUE (kind, name),
  CONSTRAINT food_tax_rates_geoid_shape CHECK (
    census_geoid IS NULL
    OR (kind = 'county' AND census_geoid ~ '^[0-9]{5}$')
    OR (kind = 'city' AND census_geoid ~ '^[0-9]{7}$')
  ),
  CONSTRAINT food_tax_rates_exempt_is_zero CHECK (taxes_food OR food_rate_bps = 0)
);

-- Each order's local food tax split by city and county, for the tax report
-- (see supabase/migrations/20261021212459_order_tax_parts.sql). One row per
-- place, copied from food_tax_rates at checkout. The rows for an order add
-- up exactly to its tax_cents: each place's share is rounded to the nearest
-- cent and the place with the highest rate takes any leftover cent. Orders
-- that paid 0% because no rate was on file, and orders from before this
-- table, have no rows. Admins only; checkout writes with the service role key.
CREATE TABLE IF NOT EXISTS order_tax_parts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  food_tax_rate_id BIGINT REFERENCES food_tax_rates(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('county', 'city', 'district')),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  census_geoid TEXT,
  collected_by TEXT CHECK (collected_by IN ('state', 'self')),
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  taxable_cents INTEGER NOT NULL CHECK (taxable_cents >= 0),
  tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
  CONSTRAINT order_tax_parts_one_per_place UNIQUE (order_id, kind, name)
);

-- Updated_at trigger for products
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER store_settings_updated_at
  BEFORE UPDATE ON store_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER retail_locations_updated_at
  BEFORE UPDATE ON retail_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER store_private_settings_updated_at
  BEFORE UPDATE ON store_private_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER order_refunds_updated_at
  BEFORE UPDATE ON order_refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER food_tax_rates_updated_at
  BEFORE UPDATE ON food_tax_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_events_is_recurring ON events(is_recurring);
CREATE INDEX IF NOT EXISTS idx_retail_locations_sort_order ON retail_locations(sort_order);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);
CREATE INDEX IF NOT EXISTS idx_order_tax_parts_order_id ON order_tax_parts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_tax_parts_rate_id ON order_tax_parts(food_tax_rate_id);

-- Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_locations ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON retail_locations FROM anon;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_private_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tax_parts ENABLE ROW LEVEL SECURITY;

-- Signed-out visitors get no access to the private settings at all.
REVOKE ALL ON store_private_settings FROM anon;

-- Orders: signed-out visitors get nothing. Signed-in users may read, and
-- change only the order columns below; the admin rules further down limit
-- both to admins. Only the service role adds or deletes rows.
REVOKE ALL ON orders, order_items, square_webhook_events FROM anon, authenticated;
GRANT SELECT ON orders, order_items, square_webhook_events TO authenticated;
GRANT UPDATE (
  status, admin_notes, tracking_number, tracking_carrier,
  ready_at, out_for_delivery_at, shipped_at, fulfilled_at, cancelled_at
) ON orders TO authenticated;
REVOKE ALL ON SEQUENCE orders_order_number_seq, order_items_id_seq FROM anon, authenticated;
REVOKE ALL ON order_refunds, order_emails FROM anon, authenticated;
GRANT SELECT ON order_refunds, order_emails TO authenticated;
-- Admins may answer what a part refund was for (the rule below).
GRANT UPDATE (refund_for, jars_cents, fees_cents, tax_cents) ON order_refunds TO authenticated;
REVOKE ALL ON SEQUENCE order_refunds_id_seq, order_emails_id_seq FROM anon, authenticated;

-- Order tax split: the same as order_items. Signed-in users may read (the
-- admin rule below limits it to admins); only the service role writes.
REVOKE ALL ON order_tax_parts FROM anon, authenticated;
GRANT SELECT ON order_tax_parts TO authenticated;
REVOKE ALL ON SEQUENCE order_tax_parts_id_seq FROM anon, authenticated;

-- Food tax rates: anyone may read; signed-out visitors may not write.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON food_tax_rates FROM anon;

-- Public read access (for the website)
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read product_categories" ON product_categories FOR SELECT USING (true);
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public read retail_locations" ON retail_locations FOR SELECT USING (true);
CREATE POLICY "Public read testimonials" ON testimonials FOR SELECT USING (true);
CREATE POLICY "Public read class_info" ON class_info FOR SELECT USING (true);
CREATE POLICY "Public read gallery_images" ON gallery_images FOR SELECT USING (true);
CREATE POLICY "Public read store_settings" ON store_settings FOR SELECT USING (true);
CREATE POLICY "Public read food_tax_rates" ON food_tax_rates FOR SELECT USING (true);

CREATE POLICY "Public read access" ON product_images FOR SELECT USING (true);

-- Admins only: accounts with app_metadata.role = "admin". Only the Supabase
-- dashboard or the service role key can set app_metadata.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

CREATE POLICY "Admin insert categories" ON categories FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update categories" ON categories FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete categories" ON categories FOR DELETE TO authenticated USING ((select public.is_admin()));

CREATE POLICY "Admin insert products" ON products FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update products" ON products FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete products" ON products FOR DELETE TO authenticated USING ((select public.is_admin()));

CREATE POLICY "Admin insert product_categories" ON product_categories FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete product_categories" ON product_categories FOR DELETE TO authenticated USING ((select public.is_admin()));

CREATE POLICY "Admin insert events" ON events FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update events" ON events FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete events" ON events FOR DELETE TO authenticated USING ((select public.is_admin()));

CREATE POLICY "Admin insert retail_locations" ON retail_locations FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update retail_locations" ON retail_locations FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete retail_locations" ON retail_locations FOR DELETE TO authenticated USING ((select public.is_admin()));

CREATE POLICY "Admin insert testimonials" ON testimonials FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update testimonials" ON testimonials FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete testimonials" ON testimonials FOR DELETE TO authenticated USING ((select public.is_admin()));

CREATE POLICY "Admin insert class_info" ON class_info FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update class_info" ON class_info FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

CREATE POLICY "Admin insert gallery_images" ON gallery_images FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update gallery_images" ON gallery_images FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete gallery_images" ON gallery_images FOR DELETE TO authenticated USING ((select public.is_admin()));

CREATE POLICY "Admin insert product_images" ON product_images FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update product_images" ON product_images FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete product_images" ON product_images FOR DELETE TO authenticated USING ((select public.is_admin()));

-- Store settings: one row, made below. Admins may change it but not add or delete rows.
CREATE POLICY "Admin update store_settings" ON store_settings FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- Private store settings: one row, made below. Admins may read and change it.
-- There is no public read rule.
CREATE POLICY "Admin read store_private_settings" ON store_private_settings FOR SELECT TO authenticated USING ((select public.is_admin()));
CREATE POLICY "Admin update store_private_settings" ON store_private_settings FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- Contest entries hold names and emails. The contest form saves with the
-- service role key, which skips these rules, so there is no public insert rule.
CREATE POLICY "Admin read contest entries" ON contest_entries FOR SELECT TO authenticated USING ((select public.is_admin()));
CREATE POLICY "Admin delete contest entries" ON contest_entries FOR DELETE TO authenticated USING ((select public.is_admin()));

-- Orders hold names, emails, phone numbers and addresses. Admins may read
-- them and update the workflow columns granted above. Checkout and the Square
-- webhook write with the service role key, so there are no insert or delete
-- rules.
CREATE POLICY "Admin read orders" ON orders FOR SELECT TO authenticated USING ((select public.is_admin()));
CREATE POLICY "Admin update orders" ON orders FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin read order_items" ON order_items FOR SELECT TO authenticated USING ((select public.is_admin()));
CREATE POLICY "Admin read square_webhook_events" ON square_webhook_events FOR SELECT TO authenticated USING ((select public.is_admin()));
CREATE POLICY "Admin read order_refunds" ON order_refunds FOR SELECT TO authenticated USING ((select public.is_admin()));
-- Only on refunds the webhook didn't split by itself, and an answer must stay.
CREATE POLICY "Admin update order_refunds" ON order_refunds FOR UPDATE TO authenticated
  USING ((select public.is_admin()) AND (refund_for IS NOT NULL OR jars_cents IS NULL))
  WITH CHECK ((select public.is_admin()) AND refund_for IS NOT NULL);
CREATE POLICY "Admin read order_emails" ON order_emails FOR SELECT TO authenticated USING ((select public.is_admin()));
CREATE POLICY "Admin read order_tax_parts" ON order_tax_parts FOR SELECT TO authenticated USING ((select public.is_admin()));

-- Food tax rates: admins may add, change and delete rows. Checkout only reads.
CREATE POLICY "Admin insert food_tax_rates" ON food_tax_rates FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update food_tax_rates" ON food_tax_rates FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete food_tax_rates" ON food_tax_rates FOR DELETE TO authenticated USING ((select public.is_admin()));

-- Default categories
INSERT INTO categories (name, slug, sort_order) VALUES
  ('Signature', 'signature', 0),
  ('Non-Spicy', 'non-spicy', 1),
  ('Spicy', 'spicy', 2),
  ('Garlic', 'garlic', 3),
  ('Sweet Heat', 'sweet-heat', 4),
  ('Traditional', 'traditional', 5),
  ('Specialty', 'specialty', 6)
ON CONFLICT (name) DO NOTHING;

-- The single store settings row, with every default
INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- The single private settings row, empty until an admin saves the address
INSERT INTO store_private_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Starting food tax rates (DR 1002, January 2026, and city documents),
-- confirmed by Jesse on 2026-10-20 just below
INSERT INTO food_tax_rates (kind, name, census_geoid, taxes_food, food_rate_bps, source, notes) VALUES
  -- Counties (DR 1002 page 5)
  ('county', 'Jefferson County', '08059', true, 50,
    'DR 1002, Jan 2026, page 5: https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Jefferson County taxes food at 0.5%, so it applies on top of every Jefferson County city, including Lakewood, which exempts food itself. Part of the county is in the Southeast Jefferson County LID (see that row).'),
  ('county', 'Adams County', '08001', false, 0,
    'DR 1002, Jan 2026, page 5: https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Exempts food.'),
  ('county', 'Arapahoe County', '08005', false, 0,
    'DR 1002, Jan 2026, page 5: https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Exempts food.'),
  ('county', 'Douglas County', '08035', false, 0,
    'DR 1002, Jan 2026, page 5: https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Exempts food. Part of the county is in the Lincoln Station LID (see that row).'),
  ('county', 'Denver County', '08031', false, 0,
    'DR 1002, Jan 2026, page 5: https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Denver is one city and county. The Denver city row carries its food rule; this row is here so checkout finds the county.'),
  ('county', 'Broomfield County', '08014', false, 0,
    'DR 1002, Jan 2026, page 5: https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Broomfield is one city and county. Its whole food rate sits on the Broomfield city row, and this row stays at 0% so the rate is not counted twice.'),

  -- Cities that tax food (city part only; checkout adds the county)
  ('city', 'Wheat Ridge', '0884440', true, 350,
    'Wheat Ridge sales tax: https://www.ci.wheatridge.co.us/168/Sales-Tax',
    'Total on food 4.0% with Jefferson County.'),
  ('city', 'Golden', '0830835', true, 300,
    'Golden taxes and fees: https://www.cityofgolden.gov/business/taxes_fees.php',
    'Total on food 3.5% with Jefferson County.'),
  ('city', 'Arvada', '0803455', true, 346,
    'Arvada food tax: https://www.arvadaco.gov/336/Food',
    'Arvada lies in Adams and Jefferson counties: 3.46% total in the Adams part, 3.96% in the Jefferson part. Medium confidence.'),
  ('city', 'Westminster', '0883835', true, 425,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'New for 2026. Westminster lies in Adams and Jefferson counties: 4.25% total in the Adams part, 4.75% in the Jefferson part. Medium confidence.'),
  ('city', 'Thornton', '0877290', true, 375,
    'Thornton tax information: https://www.thorntonco.gov/media/file/commonly-missed-tax-information',
    'Part of Thornton is in Weld County, which is not in this table, so those addresses go to review.'),
  ('city', 'Northglenn', '0854330', true, 300,
    'Northglenn tax code: https://municode.northglenn.org/ch5/content_5-3.html',
    'Reduced rate for food. Part of Northglenn is in Weld County, which is not in this table, so those addresses go to review.'),
  ('city', 'Federal Heights', '0826270', true, 400,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),
  ('city', 'Edgewater', '0823135', true, 350,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Total on food 4.0% with Jefferson County.'),
  ('city', 'Lakeside', '0842495', true, 280,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Total on food 3.3% with Jefferson County.'),
  ('city', 'Mountain View', '0852350', true, 400,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Total on food 4.5% with Jefferson County.'),
  ('city', 'Morrison', '0852075', true, 375,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Total on food 4.25% with Jefferson County.'),
  ('city', 'Broomfield', '0809280', true, 415,
    'Broomfield tax document: https://broomfield.org/DocumentCenter/View/23544',
    'Broomfield is one city and county; the whole food rate is on this row and the county row is 0%. The source is a 2017 document, so check the current rate.'),

  -- Cities that exempt food
  ('city', 'Denver', '0820000', false, 0,
    'Denver business tax FAQ: https://denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Department-of-Finance/Our-Divisions/Treasury/Business-Tax-Information/Business-Tax-FAQ',
    'Exempts food. Denver says sellers who deliver into Denver still need a Denver license.'),
  ('city', 'Lakewood', '0843000', false, 0,
    'Lakewood sales tax guide: https://www.lakewoodco.gov/files/assets/public/v/2/finance/pdfs/sales-tax-final-2.2023-ada.pdf',
    'The city exempts food, but Jefferson County''s 0.5% still applies. Parts of Lakewood are in the Southeast Jefferson County LID (0.43% there).'),
  ('city', 'Aurora', '0804000', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Aurora lies in Adams, Arapahoe and Douglas counties.'),
  ('city', 'Commerce City', '0816495', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),
  ('city', 'Englewood', '0824785', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),
  ('city', 'Littleton', '0845255', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Littleton lies in Arapahoe, Douglas and Jefferson counties. The Jefferson part pays the county''s 0.5%, and parts of it are in the Southeast Jefferson County LID (0.43% there).'),
  ('city', 'Sheridan', '0869645', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),
  ('city', 'Glendale', '0830340', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),
  ('city', 'Centennial', '0812815', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),
  ('city', 'Greenwood Village', '0833035', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),
  ('city', 'Cherry Hills Village', '0813845', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),
  ('city', 'Lone Tree', '0845955', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Part of Lone Tree may be in the Lincoln Station LID (0.5%).'),
  ('city', 'Columbine Valley', '0816385', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),
  ('city', 'Foxfield', '0828105', false, 0,
    'DR 1002, Jan 2026, city tables (pages 4 and 6): https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    ''),

  -- Special districts (DR 1002 page 3). No Census code: checkout can't tell
  -- whether an address is inside one, so it sends Jefferson and Douglas
  -- County orders for review instead.
  ('district', 'Southeast Jefferson County LID', NULL, true, 50,
    'DR 1002, Jan 2026, page 3: https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Local improvement district. 0.5% in most of it, but 0.43% inside Lakewood and Littleton. Its boundaries aren''t known yet, so each address needs a manual check.'),
  ('district', 'Lincoln Station LID', NULL, true, 50,
    'DR 1002, Jan 2026, page 3: https://spl.cde.state.co.us/artemis/revserials/rev914internet/rev914202601internet.pdf',
    'Local improvement district in Douglas County, near Lone Tree and Highlands Ranch. Its boundaries aren''t known yet, so each address needs a manual check.')
ON CONFLICT (kind, name) DO NOTHING;

-- Jesse approved the starting rates as they stand (see
-- supabase/migrations/20261021000126_confirm_food_tax_rates.sql)
UPDATE food_tax_rates SET confirmed = true WHERE NOT confirmed;

-- Storage bucket for images
-- Run this separately in the Supabase dashboard or via the API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

-- Storage rules for the images bucket
CREATE POLICY "Public read images" ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "Admin upload images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND (select public.is_admin()));
CREATE POLICY "Admin delete images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND (select public.is_admin()));

-- Save a product, its category links and its photo list in one transaction
-- (used by the admin; see supabase/migrations/20261018201748_atomic_product_save.sql)
CREATE OR REPLACE FUNCTION public.save_product(
  p_id integer,
  p_product jsonb,
  p_category_ids integer[],
  p_images jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_id integer := p_id;
  v_ingredients text[] := coalesce(
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_product -> 'ingredients', '[]'::jsonb))),
    '{}'
  );
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can save products' USING ERRCODE = '42501';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.products
      (name, slug, size, tagline, description, ingredients, heat, category, image_url, featured,
       price_cents, sold_online, sold_out, sort_order)
    VALUES (
      p_product ->> 'name',
      p_product ->> 'slug',
      p_product ->> 'size',
      p_product ->> 'tagline',
      p_product ->> 'description',
      v_ingredients,
      coalesce((p_product ->> 'heat')::integer, 0),
      p_product ->> 'category',
      p_product ->> 'image_url',
      coalesce((p_product ->> 'featured')::boolean, false),
      (p_product ->> 'price_cents')::integer,
      coalesce((p_product ->> 'sold_online')::boolean, false),
      coalesce((p_product ->> 'sold_out')::boolean, false),
      (SELECT coalesce(max(sort_order), -1) + 1 FROM public.products)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.products SET
      name = p_product ->> 'name',
      slug = p_product ->> 'slug',
      size = p_product ->> 'size',
      tagline = p_product ->> 'tagline',
      description = p_product ->> 'description',
      ingredients = v_ingredients,
      heat = coalesce((p_product ->> 'heat')::integer, 0),
      category = p_product ->> 'category',
      image_url = p_product ->> 'image_url',
      featured = coalesce((p_product ->> 'featured')::boolean, false),
      price_cents = CASE WHEN p_product ? 'price_cents'
        THEN (p_product ->> 'price_cents')::integer ELSE price_cents END,
      sold_online = CASE WHEN p_product ? 'sold_online'
        THEN coalesce((p_product ->> 'sold_online')::boolean, false) ELSE sold_online END,
      sold_out = CASE WHEN p_product ? 'sold_out'
        THEN coalesce((p_product ->> 'sold_out')::boolean, false) ELSE sold_out END
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_id USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.product_categories WHERE product_id = v_id;
  INSERT INTO public.product_categories (product_id, category_id)
  SELECT DISTINCT v_id, cid FROM unnest(coalesce(p_category_ids, '{}')) AS cid;

  IF p_images IS NOT NULL THEN
    DELETE FROM public.product_images WHERE product_id = v_id;
    INSERT INTO public.product_images (product_id, url, alt, sort_order, is_primary)
    SELECT
      v_id,
      img ->> 'url',
      img ->> 'alt',
      coalesce((img ->> 'sort_order')::integer, 0),
      coalesce((img ->> 'is_primary')::boolean, false)
    FROM jsonb_array_elements(p_images) AS img;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_product(integer, jsonb, integer[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_product(integer, jsonb, integer[], jsonb) TO authenticated;

-- Marketing email consent log and current subscribers (see
-- supabase/migrations/20261021032047_marketing_consent.sql)
CREATE TABLE IF NOT EXISTS public.marketing_consent_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Stored in lowercase so the same address always matches.
  email TEXT NOT NULL CHECK (email = lower(btrim(email)) AND email <> ''),
  name TEXT,
  action TEXT NOT NULL CHECK (action IN ('opt_in', 'opt_out')),
  source TEXT NOT NULL CHECK (source IN ('checkout', 'contest', 'admin')),
  -- The checkbox wording the person saw, and its version.
  consent_text TEXT,
  consent_version TEXT,
  ip_address TEXT,
  user_agent TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  contest_entry_id INTEGER REFERENCES public.contest_entries(id) ON DELETE SET NULL,
  -- For admin rows: the admin's email.
  recorded_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- An opt_in must carry the wording the person agreed to.
  CONSTRAINT marketing_opt_in_has_text CHECK (action <> 'opt_in' OR consent_text IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_marketing_consent_email_created
  ON public.marketing_consent_events (email, created_at DESC, id DESC);

-- Everyone whose newest choice is opt_in. security_invoker makes the view
-- follow the table's rules, so only admins can read it.
CREATE OR REPLACE VIEW public.marketing_subscribers
WITH (security_invoker = true) AS
SELECT email, name, source, consent_version, created_at AS opted_in_at
FROM (
  SELECT DISTINCT ON (email) email, name, source, consent_version, created_at, action
  FROM public.marketing_consent_events
  ORDER BY email, created_at DESC, id DESC
) AS latest
WHERE action = 'opt_in';

ALTER TABLE public.marketing_consent_events ENABLE ROW LEVEL SECURITY;

-- Take away every right Supabase gives by default, then give signed-in
-- users back reading and adding. The rules below limit both to admins.
REVOKE ALL ON public.marketing_consent_events FROM anon, authenticated;
REVOKE ALL ON public.marketing_subscribers FROM anon, authenticated;
GRANT SELECT, INSERT ON public.marketing_consent_events TO authenticated;
GRANT SELECT ON public.marketing_subscribers TO authenticated;
REVOKE ALL ON SEQUENCE public.marketing_consent_events_id_seq FROM anon;
GRANT USAGE ON SEQUENCE public.marketing_consent_events_id_seq TO authenticated;

DROP POLICY IF EXISTS "Admin read marketing_consent_events" ON public.marketing_consent_events;
DROP POLICY IF EXISTS "Admin unsubscribe marketing_consent_events" ON public.marketing_consent_events;
CREATE POLICY "Admin read marketing_consent_events" ON public.marketing_consent_events
  FOR SELECT TO authenticated
  USING ((select public.is_admin()));
-- Admins may only add unsubscribes. Opt-ins come from the customer.
CREATE POLICY "Admin unsubscribe marketing_consent_events" ON public.marketing_consent_events
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()) AND action = 'opt_out' AND source = 'admin');

-- Home page banner: one settings row and up to 10 photos (see
-- supabase/migrations/20261022002311_home_banner.sql). Admins edit both at
-- /admin/banner. The row starts switched off. A deleted product or event
-- clears any banner link to it.
CREATE TABLE IF NOT EXISTS public.home_banner (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
  headline TEXT NOT NULL DEFAULT '' CHECK (char_length(headline) <= 80),
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
  link_type TEXT NOT NULL DEFAULT 'none'
    CHECK (link_type IN ('none', 'product', 'event', 'url')),
  link_product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
  link_event_id INTEGER REFERENCES public.events(id) ON DELETE SET NULL,
  link_url TEXT NOT NULL DEFAULT ''
    CHECK (char_length(link_url) <= 500 AND (link_url = '' OR link_url ~ '^(/[^/]|https://)')),
  link_label TEXT NOT NULL DEFAULT 'Check it out' CHECK (char_length(link_label) <= 30),
  event_section_enabled BOOLEAN NOT NULL DEFAULT true,
  event_section_mode TEXT NOT NULL DEFAULT 'auto'
    CHECK (event_section_mode IN ('auto', 'pick')),
  event_section_event_id INTEGER REFERENCES public.events(id) ON DELETE SET NULL,
  event_section_heading TEXT NOT NULL DEFAULT 'Catch us next'
    CHECK (char_length(event_section_heading) <= 40),
  theme TEXT NOT NULL DEFAULT 'night'
    CHECK (theme IN ('night', 'ember', 'cream', 'pickle', 'barrel')),
  layout TEXT NOT NULL DEFAULT 'slides_left'
    CHECK (layout IN ('slides_left', 'slides_right', 'message_over')),
  text_align TEXT NOT NULL DEFAULT 'left' CHECK (text_align IN ('left', 'center')),
  headline_font TEXT NOT NULL DEFAULT 'display' CHECK (headline_font IN ('display', 'body')),
  glow_enabled BOOLEAN NOT NULL DEFAULT true,
  glow_color TEXT NOT NULL DEFAULT 'orange_gold'
    CHECK (glow_color IN ('orange', 'gold', 'orange_gold')),
  glow_strength INTEGER NOT NULL DEFAULT 50 CHECK (glow_strength BETWEEN 0 AND 100),
  glow_speed_seconds NUMERIC(4,2) NOT NULL DEFAULT 6
    CHECK (glow_speed_seconds >= 0.5 AND glow_speed_seconds <= 15
      AND (glow_speed_seconds * 4) = floor(glow_speed_seconds * 4)),
  autoplay BOOLEAN NOT NULL DEFAULT true,
  slide_seconds INTEGER NOT NULL DEFAULT 6 CHECK (slide_seconds BETWEEN 3 AND 15),
  height_px INTEGER NOT NULL DEFAULT 360 CHECK (height_px BETWEEN 200 AND 560),
  photo_darkness INTEGER NOT NULL DEFAULT 50 CHECK (photo_darkness BETWEEN 0 AND 80),
  bg_color TEXT CHECK (bg_color IS NULL OR bg_color ~ '^#[0-9a-fA-F]{6}$'),
  headline_color TEXT CHECK (headline_color IS NULL OR headline_color ~ '^#[0-9a-fA-F]{6}$'),
  message_color TEXT CHECK (message_color IS NULL OR message_color ~ '^#[0-9a-fA-F]{6}$'),
  button_color TEXT CHECK (button_color IS NULL OR button_color ~ '^#[0-9a-fA-F]{6}$'),
  button_text_color TEXT
    CHECK (button_text_color IS NULL OR button_text_color ~ '^#[0-9a-fA-F]{6}$'),
  event_bg_color TEXT CHECK (event_bg_color IS NULL OR event_bg_color ~ '^#[0-9a-fA-F]{6}$'),
  event_text_color TEXT
    CHECK (event_text_color IS NULL OR event_text_color ~ '^#[0-9a-fA-F]{6}$'),
  glow_custom_color TEXT
    CHECK (glow_custom_color IS NULL OR glow_custom_color ~ '^#[0-9a-fA-F]{6}$'),
  caption_color TEXT CHECK (caption_color IS NULL OR caption_color ~ '^#[0-9a-fA-F]{6}$'),
  border_color TEXT CHECK (border_color IS NULL OR border_color ~ '^#[0-9a-fA-F]{6}$'),
  corner_radius_px INTEGER NOT NULL DEFAULT 18 CHECK (corner_radius_px BETWEEN 0 AND 32),
  border_style TEXT NOT NULL DEFAULT 'theme'
    CHECK (border_style IN ('theme', 'none', 'thin', 'thick')),
  headline_size_pct INTEGER NOT NULL DEFAULT 100
    CHECK (headline_size_pct BETWEEN 75 AND 150 AND headline_size_pct % 5 = 0),
  button_shape TEXT NOT NULL DEFAULT 'pill'
    CHECK (button_shape IN ('pill', 'rounded', 'square')),
  button_style TEXT NOT NULL DEFAULT 'filled' CHECK (button_style IN ('filled', 'outline')),
  caption_position TEXT NOT NULL DEFAULT 'top_left'
    CHECK (caption_position IN ('top_left', 'top_right', 'bottom_left', 'bottom_right')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.home_banner_slides (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL CHECK (url ~ '^https://'),
  alt TEXT NOT NULL DEFAULT '' CHECK (char_length(alt) <= 200),
  caption TEXT NOT NULL DEFAULT '' CHECK (char_length(caption) <= 80),
  link_product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_banner_slides_sort_order
  ON public.home_banner_slides(sort_order);

CREATE TRIGGER home_banner_updated_at
  BEFORE UPDATE ON public.home_banner
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Ten photos at most. The admin page checks this too; this is the backstop.
CREATE OR REPLACE FUNCTION public.home_banner_slides_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.home_banner_slides) >= 10 THEN
    RAISE EXCEPTION 'The banner holds 10 photos at most.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER home_banner_slides_limit
  BEFORE INSERT ON public.home_banner_slides
  FOR EACH ROW
  EXECUTE FUNCTION public.home_banner_slides_limit();

ALTER TABLE public.home_banner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_banner_slides ENABLE ROW LEVEL SECURITY;

-- Anyone may read; signed-out visitors may not write.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.home_banner FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.home_banner_slides FROM anon;

CREATE POLICY "Public read home_banner" ON public.home_banner FOR SELECT USING (true);
-- One row, made below. Admins may change it but not add or delete rows.
CREATE POLICY "Admin update home_banner" ON public.home_banner FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

CREATE POLICY "Public read home_banner_slides" ON public.home_banner_slides FOR SELECT USING (true);
CREATE POLICY "Admin insert home_banner_slides" ON public.home_banner_slides FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update home_banner_slides" ON public.home_banner_slides FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete home_banner_slides" ON public.home_banner_slides FOR DELETE TO authenticated USING ((select public.is_admin()));

-- The single banner row, switched off, with every default
INSERT INTO public.home_banner (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Alerts to Jesse when something breaks, one row per kind of problem, so a
-- problem that keeps coming back alerts at most every few hours (see
-- supabase/migrations/20261021212454_owner_alerts.sql and src/lib/alerts.ts).
-- No customer details. Admins may read; server code writes with the service
-- role key.
CREATE TABLE IF NOT EXISTS public.owner_alerts (
  key TEXT PRIMARY KEY CHECK (btrim(key) <> ''),
  title TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 0),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_owner_alerts_last_seen ON public.owner_alerts (last_seen_at DESC);

ALTER TABLE public.owner_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.owner_alerts FROM anon, authenticated;
GRANT SELECT ON public.owner_alerts TO authenticated;

DROP POLICY IF EXISTS "Admin read owner_alerts" ON public.owner_alerts;
CREATE POLICY "Admin read owner_alerts" ON public.owner_alerts FOR SELECT TO authenticated
  USING ((select public.is_admin()));

-- Learn to Preserve class: dates, bookings and the 10% off codes class
-- guests get the day after class (see
-- supabase/migrations/20261029022312_class_booking.sql). Each booking's money
-- is an order of the kind 'class'. book_class_seats() locks the session row
-- while it counts seats, so a session can't be oversold. Visitors read
-- upcoming dates and seats left through upcoming_class_sessions() only.
CREATE TABLE IF NOT EXISTS public.class_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location_name TEXT NOT NULL CHECK (length(trim(location_name)) BETWEEN 1 AND 120),
  location_address TEXT CHECK (location_address IS NULL OR length(location_address) <= 200),
  seats INTEGER NOT NULL DEFAULT 6 CHECK (seats BETWEEN 1 AND 50),
  price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 100 AND 100000),
  -- Off hides the session from the class page and stops new bookings.
  -- Bookings already made stay.
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_sessions_ends_after_start CHECK (ends_at > starts_at)
);

DROP TRIGGER IF EXISTS class_sessions_updated_at ON public.class_sessions;
CREATE TRIGGER class_sessions_updated_at
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_class_sessions_starts_at ON public.class_sessions (starts_at);

CREATE TABLE IF NOT EXISTS public.class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  -- A session with bookings can't be deleted, only hidden.
  session_id BIGINT NOT NULL REFERENCES public.class_sessions(id) ON DELETE RESTRICT,
  seats INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 4),
  -- Set when Jesse cancels the booking. Frees the seats.
  cancelled_at TIMESTAMPTZ,
  cancel_note TEXT CHECK (cancel_note IS NULL OR length(cancel_note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_bookings_session_id ON public.class_bookings (session_id);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{6,32}$'),
  percent_off INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  -- The class booking that earned the code. One code per booking.
  class_booking_id UUID UNIQUE REFERENCES public.class_bookings(id) ON DELETE SET NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  -- The order that used the code. Set when checkout saves the order and
  -- cleared again if its card fails, so the code can be used once.
  order_id UUID UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_expires_after_start CHECK (expires_at > valid_from)
);

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Table rights. Signed-out visitors get nothing. Signed-in users get only
-- what admins need, and the rules below limit that to admins. Checkout and
-- the daily job write bookings and codes with the service role key.
REVOKE ALL ON public.class_sessions, public.class_bookings, public.discount_codes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;
GRANT SELECT ON public.class_bookings, public.discount_codes TO authenticated;
GRANT UPDATE (cancelled_at, cancel_note) ON public.class_bookings TO authenticated;
REVOKE ALL ON SEQUENCE public.class_sessions_id_seq, public.discount_codes_id_seq FROM anon;
GRANT USAGE ON SEQUENCE public.class_sessions_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE public.discount_codes_id_seq FROM authenticated;

DROP POLICY IF EXISTS "Admin read class_sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admin insert class_sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admin update class_sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admin delete class_sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admin read class_bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Admin update class_bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Admin read discount_codes" ON public.discount_codes;
CREATE POLICY "Admin read class_sessions" ON public.class_sessions FOR SELECT TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin insert class_sessions" ON public.class_sessions FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update class_sessions" ON public.class_sessions FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete class_sessions" ON public.class_sessions FOR DELETE TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin read class_bookings" ON public.class_bookings FOR SELECT TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin update class_bookings" ON public.class_bookings FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin read discount_codes" ON public.discount_codes FOR SELECT TO authenticated
  USING ((select public.is_admin()));

-- Seats a session has given out: bookings not cancelled whose order is
-- waiting on payment or paid, and not refunded in full. Runs with the
-- caller's rights, so only the service role and admins see real numbers.
CREATE OR REPLACE FUNCTION public.class_seats_taken(p_session_id bigint)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(sum(b.seats), 0)::integer
  FROM public.class_bookings b
  JOIN public.orders o ON o.id = b.order_id
  WHERE b.session_id = p_session_id
    AND b.cancelled_at IS NULL
    AND o.status NOT IN ('payment_failed', 'cancelled')
    AND o.refunded_cents < o.total_cents;
$$;

REVOKE EXECUTE ON FUNCTION public.class_seats_taken(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_seats_taken(bigint) TO authenticated, service_role;

-- What the class page shows: sessions that are switched on and haven't
-- started, with seats left. Bookings close 24 hours before the start.
-- Runs with the owner's rights so visitors see seat counts, never who
-- booked.
CREATE OR REPLACE FUNCTION public.upcoming_class_sessions()
RETURNS TABLE (
  id bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  location_address text,
  seats integer,
  price_cents integer,
  seats_left integer,
  booking_open boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.id, s.starts_at, s.ends_at, s.location_name, s.location_address, s.seats, s.price_cents,
    greatest(0, s.seats - public.class_seats_taken(s.id)) AS seats_left,
    s.starts_at > now() + interval '24 hours' AS booking_open
  FROM public.class_sessions s
  WHERE s.is_published AND s.starts_at > now()
  ORDER BY s.starts_at;
$$;

REVOKE EXECUTE ON FUNCTION public.upcoming_class_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upcoming_class_sessions() TO anon, authenticated, service_role;

-- Save a class booking and its order, waiting on payment, if the seats are
-- there. Called by the booking route with the service role key, before the
-- card is charged.
--
-- One booking per checkout ID: a repeat finds the booking made before.
--
-- Answers with JSON:
--   status: "booked", "existing", "not_found" (no such session, or it is
--           hidden), "closed" (starts within 24 hours), "bad_seats",
--           "price_changed" (with price_cents) or "full" (with seats_left)
--   order:  {id, order_number, public_token, status, total_cents,
--           customer_email, created_at, square_payment_id} for "booked" and
--           "existing"
CREATE OR REPLACE FUNCTION public.book_class_seats(
  p_checkout_id uuid,
  p_session_id bigint,
  p_seats integer,
  p_expected_total_cents integer,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_notes text,
  p_square_environment text,
  p_terms_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_session record;
  v_order record;
  v_left integer;
  v_total integer;
  v_label text;
BEGIN
  SELECT o.id, o.order_number, o.public_token, o.status, o.total_cents, o.customer_email,
         o.created_at, o.square_payment_id
  INTO v_order
  FROM public.orders o WHERE o.checkout_id = p_checkout_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'existing', 'order', to_jsonb(v_order));
  END IF;

  -- Lock the session. A second booking for it waits here until this one
  -- is saved, then counts the seats again.
  SELECT s.* INTO v_session
  FROM public.class_sessions s
  WHERE s.id = p_session_id AND s.is_published
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_session.starts_at <= now() + interval '24 hours' THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;
  IF p_seats IS NULL OR p_seats < 1 OR p_seats > 4 THEN
    RETURN jsonb_build_object('status', 'bad_seats');
  END IF;

  v_total := v_session.price_cents * p_seats;
  IF v_total <> p_expected_total_cents THEN
    RETURN jsonb_build_object('status', 'price_changed', 'price_cents', v_session.price_cents);
  END IF;

  v_left := v_session.seats - public.class_seats_taken(p_session_id);
  IF v_left < p_seats THEN
    RETURN jsonb_build_object('status', 'full', 'seats_left', greatest(v_left, 0));
  END IF;

  -- "Sat, Nov 15, 10:00 AM", in Colorado time.
  v_label := to_char(v_session.starts_at AT TIME ZONE 'America/Denver', 'Dy, Mon FMDD, FMHH12:MI AM');

  BEGIN
    INSERT INTO public.orders (
      checkout_id, status, fulfillment_type,
      customer_name, customer_email, customer_phone, customer_notes,
      subtotal_cents, tax_cents, total_cents, tax_rate_bps, tax_jurisdiction,
      square_environment, terms_accepted_at, terms_version
    ) VALUES (
      p_checkout_id, 'pending_payment', 'class',
      p_customer_name, p_customer_email, nullif(p_customer_phone, ''), nullif(p_customer_notes, ''),
      v_total, 0, v_total, 0, 'Class (not taxed)',
      p_square_environment, now(), p_terms_version
    )
    RETURNING id, order_number, public_token, status, total_cents, customer_email, created_at,
              square_payment_id
    INTO v_order;
  EXCEPTION WHEN unique_violation THEN
    -- The same checkout saved a moment ago in another request.
    SELECT o.id, o.order_number, o.public_token, o.status, o.total_cents, o.customer_email,
           o.created_at, o.square_payment_id
    INTO v_order
    FROM public.orders o WHERE o.checkout_id = p_checkout_id;
    RETURN jsonb_build_object('status', 'existing', 'order', to_jsonb(v_order));
  END;

  INSERT INTO public.order_items (
    order_id, product_id, product_name, product_size, unit_price_cents, quantity, line_total_cents
  ) VALUES (
    v_order.id, NULL, 'Learn to Preserve class', v_label, v_session.price_cents, p_seats, v_total
  );

  INSERT INTO public.class_bookings (order_id, session_id, seats)
  VALUES (v_order.id, p_session_id, p_seats);

  RETURN jsonb_build_object('status', 'booked', 'order', to_jsonb(v_order));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_class_seats(uuid, bigint, integer, integer, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_class_seats(uuid, bigint, integer, integer, text, text, text, text, text, text)
  TO service_role;

-- How much a discount code takes off, if it can be used now: not used by
-- another order, started and not expired. p_order_id lets a retry of the
-- same checkout see its own code as usable. Answers null when it can't.
CREATE OR REPLACE FUNCTION public.discount_code_percent(p_code text, p_order_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT d.percent_off
  FROM public.discount_codes d
  WHERE d.code = upper(trim(p_code))
    AND (d.order_id IS NULL OR d.order_id = p_order_id)
    AND now() >= d.valid_from
    AND now() < d.expires_at;
$$;

-- Mark a code used by an order. Answers true when this order now holds it,
-- false when another order has it or it can't be used.
CREATE OR REPLACE FUNCTION public.claim_discount_code(p_code text, p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.discount_codes
  SET order_id = p_order_id, claimed_at = now()
  WHERE code = upper(trim(p_code))
    AND (order_id IS NULL OR order_id = p_order_id)
    AND now() >= valid_from
    AND now() < expires_at;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.discount_code_percent(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_discount_code(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discount_code_percent(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_discount_code(text, uuid) TO service_role;

-- When an order's card fails, free the discount code it held, whichever
-- part of the site marked it (checkout or the Square webhook).
CREATE OR REPLACE FUNCTION public.free_discount_code_on_failed_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.discount_codes SET order_id = NULL, claimed_at = NULL WHERE order_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.free_discount_code_on_failed_payment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_free_discount_code ON public.orders;
CREATE TRIGGER orders_free_discount_code
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'payment_failed' AND OLD.status IS DISTINCT FROM 'payment_failed')
  EXECUTE FUNCTION public.free_discount_code_on_failed_payment();
