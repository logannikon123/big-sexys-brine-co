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
-- write with the service role key.
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number INTEGER GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,
  public_token TEXT UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
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
