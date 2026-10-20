-- Store settings for online ordering (exactly one row).
--
-- One row holds every setting the shop needs to take orders: the master
-- switch, pickup, local delivery, shipping and sales tax. Admins edit it at
-- /admin/store. Online ordering stays hidden until orders_open is on.
--
-- Units: money is in whole cents (500 = $5.00), weights are in ounces, box
-- sizes are in inches, and the tax rate is in hundredths of a percent
-- (400 = 4.00%).
--
-- Anyone may read the row, because checkout needs the fees and the delivery
-- ZIP codes and none of it is secret. Only admins may change it. Nobody may
-- add or delete rows through the API: the row is created here, and the
-- CHECK on id stops a second row.

CREATE TABLE IF NOT EXISTS public.store_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Master switch
  orders_open BOOLEAN NOT NULL DEFAULT false,

  -- Pickup
  pickup_enabled BOOLEAN NOT NULL DEFAULT true,
  pickup_instructions TEXT NOT NULL DEFAULT '',

  -- Local delivery
  delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  delivery_zip_codes TEXT[] NOT NULL DEFAULT '{}'
    CHECK (array_position(delivery_zip_codes, NULL) IS NULL
    AND array_to_string(delivery_zip_codes, ',') ~ '^([0-9]{5}(,[0-9]{5})*)?$'),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 500 CHECK (delivery_fee_cents >= 0),
  delivery_min_order_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_min_order_cents >= 0),
  delivery_free_over_cents INTEGER CHECK (delivery_free_over_cents >= 0),
  delivery_instructions TEXT NOT NULL DEFAULT '',

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

DROP TRIGGER IF EXISTS store_settings_updated_at ON public.store_settings;
CREATE TRIGGER store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admin update store_settings" ON public.store_settings;
CREATE POLICY "Public read store_settings" ON public.store_settings FOR SELECT
  USING (true);
CREATE POLICY "Admin update store_settings" ON public.store_settings FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- The single row, with every default above.
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
