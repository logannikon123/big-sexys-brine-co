-- Alerts to Jesse when something breaks (see src/lib/alerts.ts).
--
-- One row for each kind of problem, named by a short key such as
-- 'health:stuck-pending:1042'. The site checks the row before it sends, so
-- a problem that keeps coming back sends at most one phone alert and email
-- every few hours instead of one each time it happens.
--
-- key:          the problem's name, chosen by the code that raises it
-- title:        the alert's title the last time it came up
-- count:        how many times it has come up, sent or held back
-- last_seen_at: the last time it came up
-- last_sent_at: the last time an alert went out; NULL if none got through
--
-- Rows hold no customer details, only order numbers at most. Admins may
-- read them (the dashboard shows the latest). Only server code writes them,
-- with the service role key, which skips these rules, so there are no
-- insert, update or delete rules.

CREATE TABLE IF NOT EXISTS public.owner_alerts (
  key TEXT PRIMARY KEY CHECK (btrim(key) <> ''),
  title TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 0),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ
);

-- For the dashboard: newest first.
CREATE INDEX IF NOT EXISTS idx_owner_alerts_last_seen ON public.owner_alerts (last_seen_at DESC);

ALTER TABLE public.owner_alerts ENABLE ROW LEVEL SECURITY;

-- Take away every right Supabase gives by default, then give signed-in
-- users back reading. The rule below limits that to admins.
REVOKE ALL ON public.owner_alerts FROM anon, authenticated;
GRANT SELECT ON public.owner_alerts TO authenticated;

DROP POLICY IF EXISTS "Admin read owner_alerts" ON public.owner_alerts;
CREATE POLICY "Admin read owner_alerts" ON public.owner_alerts FOR SELECT TO authenticated
  USING ((select public.is_admin()));
