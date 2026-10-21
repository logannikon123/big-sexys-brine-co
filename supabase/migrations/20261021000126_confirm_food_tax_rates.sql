-- Mark every starting food tax rate as confirmed, so checkout charges them.
--
-- Jesse approved the rates on 2026-10-20 as they stand: the Colorado
-- Department of Revenue's DR 1002 ("Colorado Sales/Use Tax Rates", January
-- 2026), with each city's own website where DR 1002 gives no food rate. Each
-- row's source column names the document it came from. The figures are
-- unchanged; only the confirmed tick is set.
--
-- Admins can still change or untick any row at /admin/tax.

UPDATE public.food_tax_rates
SET confirmed = true
WHERE NOT confirmed;
