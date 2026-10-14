-- Baseline: contest_entries, as it exists in the live database (October 2026).
--
-- This table was created by hand and never had a migration. This file
-- records it exactly as it is, so a fresh database built from the
-- migrations matches the live one. It is marked as already applied on the
-- live database (supabase migration repair), so it never runs there.
-- Every statement is written to be safe to run again.

CREATE TABLE IF NOT EXISTS public.contest_entries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  pun TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit contest entries" ON public.contest_entries;
CREATE POLICY "Anyone can submit contest entries" ON public.contest_entries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read contest entries" ON public.contest_entries;
CREATE POLICY "Authenticated users can read contest entries" ON public.contest_entries
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete contest entries" ON public.contest_entries;
CREATE POLICY "Authenticated users can delete contest entries" ON public.contest_entries
  FOR DELETE USING (auth.role() = 'authenticated');
