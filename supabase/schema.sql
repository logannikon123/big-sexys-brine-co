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
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_events_is_recurring ON events(is_recurring);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

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

-- Public read access (for the website)
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read product_categories" ON product_categories FOR SELECT USING (true);
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public read testimonials" ON testimonials FOR SELECT USING (true);
CREATE POLICY "Public read class_info" ON class_info FOR SELECT USING (true);
CREATE POLICY "Public read gallery_images" ON gallery_images FOR SELECT USING (true);

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

-- Contest entries hold names and emails. The contest form saves with the
-- service role key, which skips these rules, so there is no public insert rule.
CREATE POLICY "Admin read contest entries" ON contest_entries FOR SELECT TO authenticated USING ((select public.is_admin()));
CREATE POLICY "Admin delete contest entries" ON contest_entries FOR DELETE TO authenticated USING ((select public.is_admin()));

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
      (name, slug, size, tagline, description, ingredients, heat, category, image_url, featured, sort_order)
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
      featured = coalesce((p_product ->> 'featured')::boolean, false)
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
