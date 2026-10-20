-- Local sales tax rates on food, one row for each taxing place (online
-- ordering, tax step).
--
-- Colorado's state tax (2.9%), RTD and SCFD don't tax food for home use, so
-- only counties, cities and a few special districts can charge tax on
-- pickles. Each row says whether that place taxes food and at what rate.
-- Checkout adds up the rows that apply to the delivery address: the city (if
-- the address is inside one) plus the county. See src/lib/food-tax.ts.
--
-- census_geoid is the code the US Census geocoder returns for an address:
--   county:   5 digits, state 08 + county (Jefferson County = '08059')
--   city:     7 digits, state 08 + place (Lakewood = '0843000')
--   district: always NULL. The geocoder can't tell whether an address is
--             inside a district, so checkout never adds district rows.
--
-- The rate is in hundredths of a percent (50 = 0.50%, 346 = 3.46%). It is
-- the part that applies to food, and 0 when the place exempts food.
--
-- Nothing is charged from a row until an admin ticks "confirmed". Jesse and
-- his accountant check each rate first. Every row below starts unconfirmed.
--
-- Rates are public information and checkout reads them, so anyone may read.
-- Only admins may add, change or delete rows.
--
-- Source for the starting rows: Colorado Department of Revenue DR 1002,
-- "Colorado Sales/Use Tax Rates", January 2026 (exemption "A" is food for
-- home consumption), plus each home-rule city's own documents. Refresh every
-- January 1 and July 1, and after November elections.

CREATE TABLE IF NOT EXISTS public.food_tax_rates (
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

  CONSTRAINT food_tax_rates_kind_name_key UNIQUE (kind, name),
  -- A county code has 5 digits and a city code 7. Districts have none.
  CONSTRAINT food_tax_rates_geoid_shape CHECK (
    census_geoid IS NULL
    OR (kind = 'county' AND census_geoid ~ '^[0-9]{5}$')
    OR (kind = 'city' AND census_geoid ~ '^[0-9]{7}$')
  ),
  -- A place that exempts food has a food rate of 0.
  CONSTRAINT food_tax_rates_exempt_is_zero CHECK (taxes_food OR food_rate_bps = 0)
);

DROP TRIGGER IF EXISTS food_tax_rates_updated_at ON public.food_tax_rates;
CREATE TRIGGER food_tax_rates_updated_at
  BEFORE UPDATE ON public.food_tax_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.food_tax_rates ENABLE ROW LEVEL SECURITY;

-- Signed-out visitors may only read.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.food_tax_rates FROM anon;

DROP POLICY IF EXISTS "Public read food_tax_rates" ON public.food_tax_rates;
DROP POLICY IF EXISTS "Admin insert food_tax_rates" ON public.food_tax_rates;
DROP POLICY IF EXISTS "Admin update food_tax_rates" ON public.food_tax_rates;
DROP POLICY IF EXISTS "Admin delete food_tax_rates" ON public.food_tax_rates;
CREATE POLICY "Public read food_tax_rates" ON public.food_tax_rates FOR SELECT
  USING (true);
CREATE POLICY "Admin insert food_tax_rates" ON public.food_tax_rates FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update food_tax_rates" ON public.food_tax_rates FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete food_tax_rates" ON public.food_tax_rates FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- Starting rows, all unconfirmed. Each Census code was checked against the
-- Census Bureau's lists of places and counties (TIGERweb) and the geocoder.
-- ON CONFLICT keeps a second run from adding rows twice.
INSERT INTO public.food_tax_rates (kind, name, census_geoid, taxes_food, food_rate_bps, source, notes) VALUES
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
