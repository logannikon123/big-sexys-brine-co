-- Price local delivery by driving distance instead of by ZIP code.
--
-- The fee is a set amount for each started step of miles, one way from the
-- starting point. With the defaults ($5 for each started 6 miles, up to 24
-- miles): 0 to 6 miles costs $5, over 6 to 12 costs $10, over 12 to 18 costs
-- $15, over 18 to 24 costs $20, and past 24 miles there is no delivery.
--
-- Standard delivery takes up to delivery_standard_hours. A customer who picks
-- an earlier date pays rush_fee_cents on top. Free delivery is off by default.
-- When it is on, an order gets free delivery only if it is within
-- free_delivery_max_miles AND its subtotal is at least
-- free_delivery_min_order_cents. Free delivery waives the distance fee, not
-- the rush fee.
--
-- The ZIP code list, the flat fee and the old free-delivery amount go away.
-- The live row still held their defaults (no ZIP codes, $5, never free)
-- when this was written, so nothing an admin entered is lost.
--
-- The starting point (the owner's home or kitchen address) lives in a
-- separate table that only admins can read, because store_settings is public.

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS delivery_max_miles NUMERIC(5,1) NOT NULL DEFAULT 24
    CHECK (delivery_max_miles > 0),
  ADD COLUMN IF NOT EXISTS delivery_step_miles NUMERIC(5,1) NOT NULL DEFAULT 6
    CHECK (delivery_step_miles > 0),
  ADD COLUMN IF NOT EXISTS delivery_fee_per_step_cents INTEGER NOT NULL DEFAULT 500
    CHECK (delivery_fee_per_step_cents >= 0),
  ADD COLUMN IF NOT EXISTS delivery_standard_hours INTEGER NOT NULL DEFAULT 72
    CHECK (delivery_standard_hours > 0),
  ADD COLUMN IF NOT EXISTS rush_fee_cents INTEGER NOT NULL DEFAULT 1500
    CHECK (rush_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS free_delivery_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_delivery_max_miles NUMERIC(5,1)
    CHECK (free_delivery_max_miles > 0),
  ADD COLUMN IF NOT EXISTS free_delivery_min_order_cents INTEGER
    CHECK (free_delivery_min_order_cents >= 0),
  DROP COLUMN IF EXISTS delivery_zip_codes,
  DROP COLUMN IF EXISTS delivery_fee_cents,
  DROP COLUMN IF EXISTS delivery_free_over_cents;

-- Private settings (exactly one row): admins only, never the public.
CREATE TABLE IF NOT EXISTS public.store_private_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Where delivery distance is measured from. The address is what the admin
  -- typed. The matched address, latitude and longitude come from the US
  -- Census geocoder when the admin saves it.
  delivery_origin_address TEXT NOT NULL DEFAULT '',
  delivery_origin_lat DOUBLE PRECISION,
  delivery_origin_lon DOUBLE PRECISION,
  delivery_origin_matched_address TEXT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS store_private_settings_updated_at ON public.store_private_settings;
CREATE TRIGGER store_private_settings_updated_at
  BEFORE UPDATE ON public.store_private_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.store_private_settings ENABLE ROW LEVEL SECURITY;

-- Signed-out visitors get no access at all, whatever the rules below say.
REVOKE ALL ON public.store_private_settings FROM anon;

-- Admins may read and change the row. There is no public read rule, and no
-- insert or delete rule: the row is created here, and the CHECK on id stops
-- a second row.
DROP POLICY IF EXISTS "Admin read store_private_settings" ON public.store_private_settings;
DROP POLICY IF EXISTS "Admin update store_private_settings" ON public.store_private_settings;
CREATE POLICY "Admin read store_private_settings" ON public.store_private_settings FOR SELECT TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin update store_private_settings" ON public.store_private_settings FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- The single row, empty until an admin saves the address.
INSERT INTO public.store_private_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
