-- Marketing email consent: who agreed to get marketing emails, and proof
-- of it.
--
-- marketing_consent_events is a log. Each row is one choice: a customer
-- ticking "Email me about..." at checkout or on the contest form (opt_in),
-- or an unsubscribe (opt_out). Rows are only ever added, never changed or
-- deleted, so the log stays a true record if anyone asks how we got an
-- address. A person's current choice is their newest row.
--
-- Each opt_in row keeps the proof: the exact checkbox wording and its
-- version, when, where (checkout or contest, with the order or entry), and
-- the visitor's IP address and browser.
--
-- marketing_subscribers lists everyone whose newest row is opt_in.
--
-- These rows hold personal details. Signed-out visitors get no access.
-- Admins can read everything and add opt_out rows (to unsubscribe someone).
-- Checkout and the contest form add opt_in rows with the service role key.

CREATE TABLE IF NOT EXISTS public.marketing_consent_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Stored in lowercase so the same address always matches.
  email TEXT NOT NULL CHECK (email = lower(btrim(email)) AND email <> ''),
  name TEXT,
  action TEXT NOT NULL CHECK (action IN ('opt_in', 'opt_out')),
  source TEXT NOT NULL CHECK (source IN ('checkout', 'contest', 'admin')),
  -- The checkbox wording the person saw, and its version.
  consent_text TEXT,
  consent_version TEXT,
  ip_address TEXT,
  user_agent TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  contest_entry_id INTEGER REFERENCES public.contest_entries(id) ON DELETE SET NULL,
  -- For admin rows: the admin's email.
  recorded_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- An opt_in must carry the wording the person agreed to.
  CONSTRAINT marketing_opt_in_has_text CHECK (action <> 'opt_in' OR consent_text IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_marketing_consent_email_created
  ON public.marketing_consent_events (email, created_at DESC, id DESC);

-- Everyone whose newest choice is opt_in. security_invoker makes the view
-- follow the table's rules, so only admins can read it.
CREATE OR REPLACE VIEW public.marketing_subscribers
WITH (security_invoker = true) AS
SELECT email, name, source, consent_version, created_at AS opted_in_at
FROM (
  SELECT DISTINCT ON (email) email, name, source, consent_version, created_at, action
  FROM public.marketing_consent_events
  ORDER BY email, created_at DESC, id DESC
) AS latest
WHERE action = 'opt_in';

ALTER TABLE public.marketing_consent_events ENABLE ROW LEVEL SECURITY;

-- Take away every right Supabase gives by default, then give signed-in
-- users back reading and adding. The rules below limit both to admins.
REVOKE ALL ON public.marketing_consent_events FROM anon, authenticated;
REVOKE ALL ON public.marketing_subscribers FROM anon, authenticated;
GRANT SELECT, INSERT ON public.marketing_consent_events TO authenticated;
GRANT SELECT ON public.marketing_subscribers TO authenticated;
REVOKE ALL ON SEQUENCE public.marketing_consent_events_id_seq FROM anon;
GRANT USAGE ON SEQUENCE public.marketing_consent_events_id_seq TO authenticated;

DROP POLICY IF EXISTS "Admin read marketing_consent_events" ON public.marketing_consent_events;
DROP POLICY IF EXISTS "Admin unsubscribe marketing_consent_events" ON public.marketing_consent_events;
CREATE POLICY "Admin read marketing_consent_events" ON public.marketing_consent_events
  FOR SELECT TO authenticated
  USING ((select public.is_admin()));
-- Admins may only add unsubscribes. Opt-ins come from the customer.
CREATE POLICY "Admin unsubscribe marketing_consent_events" ON public.marketing_consent_events
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()) AND action = 'opt_out' AND source = 'admin');
