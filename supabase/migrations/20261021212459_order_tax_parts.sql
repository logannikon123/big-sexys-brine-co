-- The local food tax on each order, split by city and county, for filing
-- Colorado sales tax returns (the tax report at /admin/sales/tax).
--
-- Until now an order kept only its total tax, the combined rate and a line
-- of text like "Wheat Ridge, Jefferson County". A return needs each place on
-- its own line, and needs to know who collects it: the state (the state
-- return) or the city itself (a city return in SUTS). Checkout knows all of
-- that when it works out the tax, so it now saves it here.
--
-- One row for each city or county that applies to an order. Checkout writes
-- the rows when it saves the order, copying each place's details from
-- food_tax_rates, so a later change to a rate never changes an old order.
-- An order that paid 0% because no rate was on file gets no rows. Orders
-- saved before this file have no rows either.
--
-- Money is in whole cents and rates are in hundredths of a percent (400 =
-- 4.00%), as on orders.
--
-- The rounding rule: the tax for each place is its rate times the jar
-- subtotal, rounded to the nearest cent (half a cent rounds up). If those
-- rounded amounts don't add up to the order's tax_cents, the place with the
-- highest rate takes the difference (on a tie, the city). So the rows for an
-- order always add up exactly to its tax_cents. The code lives in
-- src/lib/tax-split.ts.
--
-- Security copies orders and order_items: signed-out visitors get nothing,
-- signed-in accounts may read only if they are admins, and only checkout
-- writes, with the service role key, which skips these rules.

CREATE TABLE IF NOT EXISTS public.order_tax_parts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- The food_tax_rates row the place came from, while it exists. The copied
  -- fields below stay if the row is deleted.
  food_tax_rate_id BIGINT REFERENCES public.food_tax_rates(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('county', 'city', 'district')),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  census_geoid TEXT,
  -- 'state' (the Colorado Department of Revenue collects it), 'self' (the
  -- city collects its own) or NULL (the place has no sales tax).
  collected_by TEXT CHECK (collected_by IN ('state', 'self')),
  -- The food rate charged for this place: 0 when the place doesn't tax food.
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  -- What the rate was charged on: the jar subtotal. Fees aren't taxed.
  taxable_cents INTEGER NOT NULL CHECK (taxable_cents >= 0),
  tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
  CONSTRAINT order_tax_parts_one_per_place UNIQUE (order_id, kind, name)
);

CREATE INDEX IF NOT EXISTS idx_order_tax_parts_order_id ON public.order_tax_parts (order_id);
CREATE INDEX IF NOT EXISTS idx_order_tax_parts_rate_id ON public.order_tax_parts (food_tax_rate_id);

-- The report filters orders by the day they were paid.
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders (paid_at);

ALTER TABLE public.order_tax_parts ENABLE ROW LEVEL SECURITY;

-- Table rights, as for order_items: take every default right away from
-- signed-out and signed-in users, then give signed-in users back reading.
-- The rule below limits that to admins. The service role keeps every right.
REVOKE ALL ON public.order_tax_parts FROM anon, authenticated;
GRANT SELECT ON public.order_tax_parts TO authenticated;
REVOKE ALL ON SEQUENCE public.order_tax_parts_id_seq FROM anon, authenticated;

DROP POLICY IF EXISTS "Admin read order_tax_parts" ON public.order_tax_parts;
CREATE POLICY "Admin read order_tax_parts" ON public.order_tax_parts FOR SELECT TO authenticated
  USING ((select public.is_admin()));
