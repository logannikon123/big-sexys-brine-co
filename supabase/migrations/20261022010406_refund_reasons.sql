-- Let Jesse say what a part refund was for, so the tax report can take the
-- refunded tax off each city and county.
--
-- Square refunds an amount, not a list of items. The webhook fills in the
-- jars, fees and tax split only for a single refund of the whole order. For
-- a part refund it can't tell: a waived delivery fee carries no tax, a
-- broken jar does. So the admin order page now asks, and saves the answer
-- here:
--
-- - refund_for: 'fees' (fees only, no tax), 'jars' (jars and their tax),
--   'both' (some jars plus fees; Jesse types the jar price) or 'unsure'.
--   Empty when nobody has answered, and on rows the webhook split by itself.
-- - The site works out jars_cents, fees_cents and tax_cents from the answer
--   and the order's tax rate (src/lib/tax-split.ts). 'unsure' leaves them
--   empty, so the tax report keeps that refund in its note.
--
-- Admins may change only those four columns, and only on refunds the
-- webhook didn't split by itself. Everything else stays as Square sent it.

-- 1. The answer.
ALTER TABLE public.order_refunds
  ADD COLUMN IF NOT EXISTS refund_for TEXT
    CHECK (refund_for IN ('fees', 'jars', 'both', 'unsure'));

-- 2. An answer other than 'unsure' always comes with a split, and 'unsure'
-- never does.
ALTER TABLE public.order_refunds DROP CONSTRAINT IF EXISTS order_refunds_answer_matches_split;
ALTER TABLE public.order_refunds ADD CONSTRAINT order_refunds_answer_matches_split CHECK (
  refund_for IS NULL OR ((refund_for = 'unsure') = (jars_cents IS NULL))
);

-- 3. Rights and rules. Signed-in users may update these four columns; the
-- rule limits that to admins, on rows without the webhook's own split, and
-- an update must leave an answer in place.
GRANT UPDATE (refund_for, jars_cents, fees_cents, tax_cents) ON public.order_refunds TO authenticated;

DROP POLICY IF EXISTS "Admin update order_refunds" ON public.order_refunds;
CREATE POLICY "Admin update order_refunds" ON public.order_refunds FOR UPDATE TO authenticated
  USING ((select public.is_admin()) AND (refund_for IS NOT NULL OR jars_cents IS NULL))
  WITH CHECK ((select public.is_admin()) AND refund_for IS NOT NULL);
