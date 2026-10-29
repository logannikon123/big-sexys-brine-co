-- Booking and paying for the "Learn to Preserve" class online.
--
-- class_sessions: one row per class date, added by admins at
--   /admin/classes. Visitors never read this table directly; they get the
--   upcoming dates and seats left from upcoming_class_sessions().
-- class_bookings: one row per booking, linked to the order that pays for it.
--   The money lives in orders, as an order of the new kind 'class', so the
--   Square webhook, refunds, disputes, alerts and the admin order page work
--   for classes as they do for jars.
-- discount_codes: one-time "10% off your jars" codes. A daily job makes one
--   for each paid booking the day after its class and emails it.
--
-- Seats can't be oversold: book_class_seats() locks the session row, counts
-- the seats already taken and saves the booking in one step. A second
-- booking for the same session waits for the first to finish, then counts
-- again. A booking holds its seats while its order is waiting on payment or
-- paid. A failed payment, a cancel or a full refund frees them.
--
-- Money is in whole cents (12500 = $125.00).

-- Orders of the new kind 'class'.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_type_check
  CHECK (fulfillment_type IN ('pickup', 'local_delivery', 'shipping', 'class'));

-- Jesse's answer on 2026-10-28: a class holds 6 people.
UPDATE public.class_info SET max_students = 6 WHERE id = 1;

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location_name TEXT NOT NULL CHECK (length(trim(location_name)) BETWEEN 1 AND 120),
  location_address TEXT CHECK (location_address IS NULL OR length(location_address) <= 200),
  seats INTEGER NOT NULL DEFAULT 6 CHECK (seats BETWEEN 1 AND 50),
  price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 100 AND 100000),
  -- Off hides the session from the class page and stops new bookings.
  -- Bookings already made stay.
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_sessions_ends_after_start CHECK (ends_at > starts_at)
);

DROP TRIGGER IF EXISTS class_sessions_updated_at ON public.class_sessions;
CREATE TRIGGER class_sessions_updated_at
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_class_sessions_starts_at ON public.class_sessions (starts_at);

CREATE TABLE IF NOT EXISTS public.class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  -- A session with bookings can't be deleted, only hidden.
  session_id BIGINT NOT NULL REFERENCES public.class_sessions(id) ON DELETE RESTRICT,
  seats INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 4),
  -- Set when Jesse cancels the booking. Frees the seats.
  cancelled_at TIMESTAMPTZ,
  cancel_note TEXT CHECK (cancel_note IS NULL OR length(cancel_note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_bookings_session_id ON public.class_bookings (session_id);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{6,32}$'),
  percent_off INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  -- The class booking that earned the code. One code per booking.
  class_booking_id UUID UNIQUE REFERENCES public.class_bookings(id) ON DELETE SET NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  -- The order that used the code. Set when checkout saves the order and
  -- cleared again if its card fails, so the code can be used once.
  order_id UUID UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_expires_after_start CHECK (expires_at > valid_from)
);

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Table rights. Signed-out visitors get nothing. Signed-in users get only
-- what admins need, and the rules below limit that to admins. Checkout and
-- the daily job write bookings and codes with the service role key.
REVOKE ALL ON public.class_sessions, public.class_bookings, public.discount_codes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;
GRANT SELECT ON public.class_bookings, public.discount_codes TO authenticated;
GRANT UPDATE (cancelled_at, cancel_note) ON public.class_bookings TO authenticated;
REVOKE ALL ON SEQUENCE public.class_sessions_id_seq, public.discount_codes_id_seq FROM anon;
GRANT USAGE ON SEQUENCE public.class_sessions_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE public.discount_codes_id_seq FROM authenticated;

DROP POLICY IF EXISTS "Admin read class_sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admin insert class_sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admin update class_sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admin delete class_sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admin read class_bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Admin update class_bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Admin read discount_codes" ON public.discount_codes;
CREATE POLICY "Admin read class_sessions" ON public.class_sessions FOR SELECT TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin insert class_sessions" ON public.class_sessions FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update class_sessions" ON public.class_sessions FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete class_sessions" ON public.class_sessions FOR DELETE TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin read class_bookings" ON public.class_bookings FOR SELECT TO authenticated
  USING ((select public.is_admin()));
CREATE POLICY "Admin update class_bookings" ON public.class_bookings FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin read discount_codes" ON public.discount_codes FOR SELECT TO authenticated
  USING ((select public.is_admin()));

-- Seats a session has given out: bookings not cancelled whose order is
-- waiting on payment or paid, and not refunded in full. Runs with the
-- caller's rights, so only the service role and admins see real numbers.
CREATE OR REPLACE FUNCTION public.class_seats_taken(p_session_id bigint)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(sum(b.seats), 0)::integer
  FROM public.class_bookings b
  JOIN public.orders o ON o.id = b.order_id
  WHERE b.session_id = p_session_id
    AND b.cancelled_at IS NULL
    AND o.status NOT IN ('payment_failed', 'cancelled')
    AND o.refunded_cents < o.total_cents;
$$;

REVOKE EXECUTE ON FUNCTION public.class_seats_taken(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_seats_taken(bigint) TO authenticated, service_role;

-- What the class page shows: sessions that are switched on and haven't
-- started, with seats left. Bookings close 24 hours before the start.
-- Runs with the owner's rights so visitors see seat counts, never who
-- booked.
CREATE OR REPLACE FUNCTION public.upcoming_class_sessions()
RETURNS TABLE (
  id bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  location_address text,
  seats integer,
  price_cents integer,
  seats_left integer,
  booking_open boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.id, s.starts_at, s.ends_at, s.location_name, s.location_address, s.seats, s.price_cents,
    greatest(0, s.seats - public.class_seats_taken(s.id)) AS seats_left,
    s.starts_at > now() + interval '24 hours' AS booking_open
  FROM public.class_sessions s
  WHERE s.is_published AND s.starts_at > now()
  ORDER BY s.starts_at;
$$;

REVOKE EXECUTE ON FUNCTION public.upcoming_class_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upcoming_class_sessions() TO anon, authenticated, service_role;

-- Save a class booking and its order, waiting on payment, if the seats are
-- there. Called by the booking route with the service role key, before the
-- card is charged.
--
-- One booking per checkout ID: a repeat finds the booking made before.
--
-- Answers with JSON:
--   status: "booked", "existing", "not_found" (no such session, or it is
--           hidden), "closed" (starts within 24 hours), "bad_seats",
--           "price_changed" (with price_cents) or "full" (with seats_left)
--   order:  {id, order_number, public_token, status, total_cents,
--           customer_email, created_at, square_payment_id} for "booked" and
--           "existing"
CREATE OR REPLACE FUNCTION public.book_class_seats(
  p_checkout_id uuid,
  p_session_id bigint,
  p_seats integer,
  p_expected_total_cents integer,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_notes text,
  p_square_environment text,
  p_terms_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_session record;
  v_order record;
  v_left integer;
  v_total integer;
  v_label text;
BEGIN
  SELECT o.id, o.order_number, o.public_token, o.status, o.total_cents, o.customer_email,
         o.created_at, o.square_payment_id
  INTO v_order
  FROM public.orders o WHERE o.checkout_id = p_checkout_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'existing', 'order', to_jsonb(v_order));
  END IF;

  -- Lock the session. A second booking for it waits here until this one
  -- is saved, then counts the seats again.
  SELECT s.* INTO v_session
  FROM public.class_sessions s
  WHERE s.id = p_session_id AND s.is_published
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_session.starts_at <= now() + interval '24 hours' THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;
  IF p_seats IS NULL OR p_seats < 1 OR p_seats > 4 THEN
    RETURN jsonb_build_object('status', 'bad_seats');
  END IF;

  v_total := v_session.price_cents * p_seats;
  IF v_total <> p_expected_total_cents THEN
    RETURN jsonb_build_object('status', 'price_changed', 'price_cents', v_session.price_cents);
  END IF;

  v_left := v_session.seats - public.class_seats_taken(p_session_id);
  IF v_left < p_seats THEN
    RETURN jsonb_build_object('status', 'full', 'seats_left', greatest(v_left, 0));
  END IF;

  -- "Sat, Nov 15, 10:00 AM", in Colorado time.
  v_label := to_char(v_session.starts_at AT TIME ZONE 'America/Denver', 'Dy, Mon FMDD, FMHH12:MI AM');

  BEGIN
    INSERT INTO public.orders (
      checkout_id, status, fulfillment_type,
      customer_name, customer_email, customer_phone, customer_notes,
      subtotal_cents, tax_cents, total_cents, tax_rate_bps, tax_jurisdiction,
      square_environment, terms_accepted_at, terms_version
    ) VALUES (
      p_checkout_id, 'pending_payment', 'class',
      p_customer_name, p_customer_email, nullif(p_customer_phone, ''), nullif(p_customer_notes, ''),
      v_total, 0, v_total, 0, 'Class (not taxed)',
      p_square_environment, now(), p_terms_version
    )
    RETURNING id, order_number, public_token, status, total_cents, customer_email, created_at,
              square_payment_id
    INTO v_order;
  EXCEPTION WHEN unique_violation THEN
    -- The same checkout saved a moment ago in another request.
    SELECT o.id, o.order_number, o.public_token, o.status, o.total_cents, o.customer_email,
           o.created_at, o.square_payment_id
    INTO v_order
    FROM public.orders o WHERE o.checkout_id = p_checkout_id;
    RETURN jsonb_build_object('status', 'existing', 'order', to_jsonb(v_order));
  END;

  INSERT INTO public.order_items (
    order_id, product_id, product_name, product_size, unit_price_cents, quantity, line_total_cents
  ) VALUES (
    v_order.id, NULL, 'Learn to Preserve class', v_label, v_session.price_cents, p_seats, v_total
  );

  INSERT INTO public.class_bookings (order_id, session_id, seats)
  VALUES (v_order.id, p_session_id, p_seats);

  RETURN jsonb_build_object('status', 'booked', 'order', to_jsonb(v_order));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_class_seats(uuid, bigint, integer, integer, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_class_seats(uuid, bigint, integer, integer, text, text, text, text, text, text)
  TO service_role;

-- How much a discount code takes off, if it can be used now: not used by
-- another order, started and not expired. p_order_id lets a retry of the
-- same checkout see its own code as usable. Answers null when it can't.
CREATE OR REPLACE FUNCTION public.discount_code_percent(p_code text, p_order_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT d.percent_off
  FROM public.discount_codes d
  WHERE d.code = upper(trim(p_code))
    AND (d.order_id IS NULL OR d.order_id = p_order_id)
    AND now() >= d.valid_from
    AND now() < d.expires_at;
$$;

-- Mark a code used by an order. Answers true when this order now holds it,
-- false when another order has it or it can't be used.
CREATE OR REPLACE FUNCTION public.claim_discount_code(p_code text, p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.discount_codes
  SET order_id = p_order_id, claimed_at = now()
  WHERE code = upper(trim(p_code))
    AND (order_id IS NULL OR order_id = p_order_id)
    AND now() >= valid_from
    AND now() < expires_at;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.discount_code_percent(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_discount_code(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discount_code_percent(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_discount_code(text, uuid) TO service_role;

-- When an order's card fails, free the discount code it held, whichever
-- part of the site marked it (checkout or the Square webhook).
CREATE OR REPLACE FUNCTION public.free_discount_code_on_failed_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.discount_codes SET order_id = NULL, claimed_at = NULL WHERE order_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.free_discount_code_on_failed_payment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_free_discount_code ON public.orders;
CREATE TRIGGER orders_free_discount_code
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'payment_failed' AND OLD.status IS DISTINCT FROM 'payment_failed')
  EXECUTE FUNCTION public.free_discount_code_on_failed_payment();
