-- Admin-only database rules (security finding #1, database half).
--
-- Until now every write rule allowed any signed-in account. Now they allow
-- only accounts tagged as admins: app_metadata.role = "admin". Only the
-- Supabase dashboard or the service role key can set app_metadata, so a user
-- can't give themselves the tag. The site's code checks the same tag
-- (src/lib/supabase/is-admin.ts).
--
-- Public read rules are unchanged. The contest form saves entries with the
-- service role key, which skips these rules, so the old "anyone can submit"
-- rule is no longer needed and is removed.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- categories
DROP POLICY IF EXISTS "Admin insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admin update categories" ON public.categories;
DROP POLICY IF EXISTS "Admin delete categories" ON public.categories;
CREATE POLICY "Admin insert categories" ON public.categories FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update categories" ON public.categories FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete categories" ON public.categories FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- products
DROP POLICY IF EXISTS "Admin insert products" ON public.products;
DROP POLICY IF EXISTS "Admin update products" ON public.products;
DROP POLICY IF EXISTS "Admin delete products" ON public.products;
CREATE POLICY "Admin insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update products" ON public.products FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete products" ON public.products FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- product_categories
DROP POLICY IF EXISTS "Admin insert product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admin delete product_categories" ON public.product_categories;
CREATE POLICY "Admin insert product_categories" ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete product_categories" ON public.product_categories FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- events
DROP POLICY IF EXISTS "Admin insert events" ON public.events;
DROP POLICY IF EXISTS "Admin update events" ON public.events;
DROP POLICY IF EXISTS "Admin delete events" ON public.events;
CREATE POLICY "Admin insert events" ON public.events FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update events" ON public.events FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete events" ON public.events FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- testimonials
DROP POLICY IF EXISTS "Admin insert testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Admin update testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Admin delete testimonials" ON public.testimonials;
CREATE POLICY "Admin insert testimonials" ON public.testimonials FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update testimonials" ON public.testimonials FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete testimonials" ON public.testimonials FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- class_info
DROP POLICY IF EXISTS "Admin insert class_info" ON public.class_info;
DROP POLICY IF EXISTS "Admin update class_info" ON public.class_info;
CREATE POLICY "Admin insert class_info" ON public.class_info FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update class_info" ON public.class_info FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- gallery_images
DROP POLICY IF EXISTS "Admin insert gallery_images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admin update gallery_images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admin delete gallery_images" ON public.gallery_images;
CREATE POLICY "Admin insert gallery_images" ON public.gallery_images FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update gallery_images" ON public.gallery_images FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete gallery_images" ON public.gallery_images FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- product_images: the old single "manage" rule is split into insert, update and delete.
DROP POLICY IF EXISTS "Authenticated users can manage product images" ON public.product_images;
DROP POLICY IF EXISTS "Admin insert product_images" ON public.product_images;
DROP POLICY IF EXISTS "Admin update product_images" ON public.product_images;
DROP POLICY IF EXISTS "Admin delete product_images" ON public.product_images;
CREATE POLICY "Admin insert product_images" ON public.product_images FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update product_images" ON public.product_images FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete product_images" ON public.product_images FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- contest_entries: people's names and emails, so admins only. No public insert rule.
DROP POLICY IF EXISTS "Anyone can submit contest entries" ON public.contest_entries;
DROP POLICY IF EXISTS "Authenticated users can read contest entries" ON public.contest_entries;
DROP POLICY IF EXISTS "Authenticated users can delete contest entries" ON public.contest_entries;
DROP POLICY IF EXISTS "Admin read contest entries" ON public.contest_entries;
DROP POLICY IF EXISTS "Admin delete contest entries" ON public.contest_entries;
CREATE POLICY "Admin read contest entries" ON public.contest_entries FOR SELECT TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin delete contest entries" ON public.contest_entries FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- Storage: uploads to and deletes from the "images" bucket.
DROP POLICY IF EXISTS "Admin upload images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete images" ON storage.objects;
CREATE POLICY "Admin upload images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND (select public.is_admin()));
CREATE POLICY "Admin delete images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND (select public.is_admin()));
