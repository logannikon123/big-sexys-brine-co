-- Keep the money side of an order apart from the delivery step, record each
-- refund, and log the emails sent to customers.
--
-- Before this, a refund or a card dispute overwrote orders.status, so a
-- partly refunded order lost its step ("ready for pickup", "shipped") and
-- Jesse had no buttons left to finish it. Now:
--
-- - orders.status is only the delivery step: pending_payment,
--   payment_failed, paid, ready_for_pickup, out_for_delivery, shipped,
--   fulfilled or cancelled. Square sets the first three; Jesse sets the rest.
-- - orders.refund_status ('none', 'partial', 'full') is worked out by the
--   database from refunded_cents and total_cents, so it can never disagree
--   with them.
-- - orders.dispute_status ('open', 'won', 'lost', or NULL for no dispute)
--   comes from Square's dispute messages.
-- - order_refunds has one row for each refund Square tells us about: its id,
--   amount, time and, when we can tell, how much of it was jars, fees and
--   tax. The tax part matters for sales tax returns.
-- - order_emails has one row for each email sent to a customer after the
--   receipt. The unique key stops the same email going out twice.
--
-- Like the other order tables, the new tables hold customer data: admins may
-- read them, and only the server (with the service role key) writes them.

-- 1. New order columns.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_status TEXT GENERATED ALWAYS AS (
    CASE
      WHEN refunded_cents <= 0 THEN 'none'
      WHEN refunded_cents >= total_cents THEN 'full'
      ELSE 'partial'
    END
  ) STORED,
  ADD COLUMN IF NOT EXISTS dispute_status TEXT
    CHECK (dispute_status IN ('open', 'won', 'lost')),
  ADD COLUMN IF NOT EXISTS square_dispute_id TEXT,
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_closed_at TIMESTAMPTZ;

-- 2. Move today's refund and dispute statuses onto the new columns. A
-- disputed order gets an open dispute, dated by its last change. Then each
-- of these orders goes back to the last step it reached, read from the step
-- times. refunded_cents already holds the refunded amount, so refund_status
-- fills itself in.
UPDATE public.orders
SET dispute_status = 'open', disputed_at = updated_at
WHERE status = 'disputed';

UPDATE public.orders
SET status = CASE
  WHEN cancelled_at IS NOT NULL THEN 'cancelled'
  WHEN fulfilled_at IS NOT NULL THEN 'fulfilled'
  WHEN shipped_at IS NOT NULL THEN 'shipped'
  WHEN out_for_delivery_at IS NOT NULL THEN 'out_for_delivery'
  WHEN ready_at IS NOT NULL THEN 'ready_for_pickup'
  ELSE 'paid'
END
WHERE status IN ('refunded', 'partially_refunded', 'disputed');

-- 3. status may no longer hold a refund or dispute.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending_payment', 'payment_failed', 'paid', 'ready_for_pickup',
  'out_for_delivery', 'shipped', 'fulfilled', 'cancelled'
));

-- 4. One row for each refund.
CREATE TABLE IF NOT EXISTS public.order_refunds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- Square's id for the refund. Empty only on rows copied in below from
  -- refunds made before this table existed.
  square_refund_id TEXT UNIQUE,
  square_payment_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  -- Square's word for where the refund stands: PENDING, COMPLETED, REJECTED
  -- or FAILED. Only COMPLETED refunds gave money back.
  status TEXT NOT NULL,
  -- The reason typed in the Square Dashboard, if any.
  reason TEXT,
  -- How the refund splits into jars, fees (delivery, rush, packing and
  -- postage) and sales tax. Square refunds an amount, not a list of items,
  -- so the split is filled in only when it is certain: a single refund of
  -- the whole order. Otherwise all three are empty.
  jars_cents INTEGER CHECK (jars_cents >= 0),
  fees_cents INTEGER CHECK (fees_cents >= 0),
  tax_cents INTEGER CHECK (tax_cents >= 0),
  -- 'square' for rows from Square's refund messages, 'backfill' for the
  -- rows copied in below.
  source TEXT NOT NULL DEFAULT 'square' CHECK (source IN ('square', 'backfill')),
  -- When Square made the refund.
  refunded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The three parts are all filled in or all empty, and add up.
  CONSTRAINT order_refunds_parts_add_up CHECK (
    (jars_cents IS NULL AND fees_cents IS NULL AND tax_cents IS NULL)
    OR (jars_cents + fees_cents + tax_cents = amount_cents)
  )
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order_id ON public.order_refunds (order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_refunded_at ON public.order_refunds (refunded_at);

DROP TRIGGER IF EXISTS order_refunds_updated_at ON public.order_refunds;
CREATE TRIGGER order_refunds_updated_at
  BEFORE UPDATE ON public.order_refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Refunds made before this table existed: one row per order for the whole
-- refunded amount, dated by the order's last change. Square's refund id
-- wasn't saved then, so it stays empty. A refund of the whole order splits
-- exactly into the order's own jars, fees and tax.
INSERT INTO public.order_refunds (
  order_id, square_payment_id, amount_cents, status,
  jars_cents, fees_cents, tax_cents, source, refunded_at
)
SELECT
  o.id,
  o.square_payment_id,
  o.refunded_cents,
  'COMPLETED',
  CASE WHEN o.refunded_cents = o.total_cents AND o.discount_cents = 0 THEN o.subtotal_cents END,
  CASE WHEN o.refunded_cents = o.total_cents AND o.discount_cents = 0
    THEN o.delivery_fee_cents + o.rush_fee_cents + o.packing_fee_cents + o.shipping_postage_cents END,
  CASE WHEN o.refunded_cents = o.total_cents AND o.discount_cents = 0 THEN o.tax_cents END,
  'backfill',
  o.updated_at
FROM public.orders o
WHERE o.refunded_cents > 0
  AND NOT EXISTS (SELECT 1 FROM public.order_refunds r WHERE r.order_id = o.id);

-- 5. One row for each email sent to a customer after the receipt.
CREATE TABLE IF NOT EXISTS public.order_emails (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'ready_for_pickup', 'out_for_delivery', 'shipped', 'delivered',
    'cancelled', 'refunded'
  )),
  -- Tells apart emails of the same kind: Square's refund id for a refund
  -- email, empty for the rest (each step happens once).
  event_key TEXT NOT NULL DEFAULT '',
  -- When the site took the job of sending it.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Filled in when Resend accepts the email.
  sent_at TIMESTAMPTZ,
  -- Why it didn't go, when it didn't.
  error TEXT,
  CONSTRAINT order_emails_once UNIQUE (order_id, kind, event_key)
);

-- 6. Rights and rules: admins may read, nobody else gets anything. The
-- service role keeps every right.
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_emails ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.order_refunds, public.order_emails FROM anon, authenticated;
GRANT SELECT ON public.order_refunds, public.order_emails TO authenticated;
REVOKE ALL ON SEQUENCE public.order_refunds_id_seq, public.order_emails_id_seq FROM anon, authenticated;

DROP POLICY IF EXISTS "Admin read order_refunds" ON public.order_refunds;
DROP POLICY IF EXISTS "Admin read order_emails" ON public.order_emails;
CREATE POLICY "Admin read order_refunds" ON public.order_refunds FOR SELECT TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin read order_emails" ON public.order_emails FOR SELECT TO authenticated
  USING ((select public.is_admin()));
