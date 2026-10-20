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

CREATE TRIGGER store_private_settings_updated_at
  BEFORE UPDATE ON store_private_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_events_is_recurring ON events(is_recurring);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
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

-- Public read access (for the website)
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read product_categories" ON product_categories FOR SELECT USING (true);
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public read testimonials" ON testimonials FOR SELECT USING (true);
CREATE POLICY "Public read class_info" ON class_info FOR SELECT USING (true);
CREATE POLICY "Public read gallery_images" ON gallery_images FOR SELECT USING (true);
CREATE POLICY "Public read store_settings" ON store_settings FOR SELECT USING (true);

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
