-- Stores that carry the jars, shown on the Find Us page (/events) above the
-- events. Unlike events, a store has no date: it's there until an admin
-- hides or deletes it.
--
-- address is the full street address. The page links it to Google Maps, and
-- links "Website & phone" to a Google search for the store's name and
-- address, so neither is stored here.
--
-- is_pickup_location marks the place where online orders are picked up (The
-- Karma House, Lakewood). The page shows an "Online order pickup" badge on it.
--
-- is_visible lets an admin hide a store without deleting it.
--
-- Anyone may read. Only admins may add, change or delete rows.
-- No rows are added here: Jesse adds the stores in Admin, Retail locations.

CREATE TABLE IF NOT EXISTS public.retail_locations (
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

CREATE INDEX IF NOT EXISTS idx_retail_locations_sort_order ON public.retail_locations(sort_order);

DROP TRIGGER IF EXISTS retail_locations_updated_at ON public.retail_locations;
CREATE TRIGGER retail_locations_updated_at
  BEFORE UPDATE ON public.retail_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.retail_locations ENABLE ROW LEVEL SECURITY;

-- Signed-out visitors may only read.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.retail_locations FROM anon;

DROP POLICY IF EXISTS "Public read retail_locations" ON public.retail_locations;
DROP POLICY IF EXISTS "Admin insert retail_locations" ON public.retail_locations;
DROP POLICY IF EXISTS "Admin update retail_locations" ON public.retail_locations;
DROP POLICY IF EXISTS "Admin delete retail_locations" ON public.retail_locations;
CREATE POLICY "Public read retail_locations" ON public.retail_locations FOR SELECT
  USING (true);
CREATE POLICY "Admin insert retail_locations" ON public.retail_locations FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update retail_locations" ON public.retail_locations FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete retail_locations" ON public.retail_locations FOR DELETE TO authenticated
  USING ((select public.is_admin()));
