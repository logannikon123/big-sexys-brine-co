-- Home page banner (one settings row) and its photos.
--
-- Admins edit both at /admin/banner. The banner shows at the top of the home
-- page only while it is switched on, inside its start and stop dates, and
-- has something to show. The row starts switched off, so applying this
-- migration changes nothing on the live site.
--
-- Anyone may read both tables, because the home page shows them and none of
-- it is secret. Only admins may change them. Nobody may add or delete the
-- settings row through the API: it is created here, and the CHECK on id stops
-- a second row.
--
-- Links: if a linked product or event is deleted, the link clears itself
-- (ON DELETE SET NULL), so the button never points at a missing page.
--
-- Photos live in the "images" storage bucket, in the banner/ folder. The
-- existing storage rules already let admins upload and delete there.

CREATE TABLE IF NOT EXISTS public.home_banner (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- On and off, with optional start and stop times
  enabled BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),

  -- Words
  headline TEXT NOT NULL DEFAULT '' CHECK (char_length(headline) <= 80),
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),

  -- The main button: nothing, a product, an event or a web address.
  -- A web address starts with / (a page on this site) or https://.
  link_type TEXT NOT NULL DEFAULT 'none'
    CHECK (link_type IN ('none', 'product', 'event', 'url')),
  link_product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
  link_event_id INTEGER REFERENCES public.events(id) ON DELETE SET NULL,
  link_url TEXT NOT NULL DEFAULT ''
    CHECK (char_length(link_url) <= 500 AND (link_url = '' OR link_url ~ '^(/[^/]|https://)')),
  link_label TEXT NOT NULL DEFAULT 'Check it out' CHECK (char_length(link_label) <= 30),

  -- The "Next event" card: the next upcoming event ('auto') or one picked
  -- event ('pick')
  event_section_enabled BOOLEAN NOT NULL DEFAULT true,
  event_section_mode TEXT NOT NULL DEFAULT 'auto'
    CHECK (event_section_mode IN ('auto', 'pick')),
  event_section_event_id INTEGER REFERENCES public.events(id) ON DELETE SET NULL,
  event_section_heading TEXT NOT NULL DEFAULT 'Catch us next'
    CHECK (char_length(event_section_heading) <= 40),

  -- Look and feel
  theme TEXT NOT NULL DEFAULT 'night'
    CHECK (theme IN ('night', 'ember', 'cream', 'pickle', 'barrel')),
  layout TEXT NOT NULL DEFAULT 'slides_left'
    CHECK (layout IN ('slides_left', 'slides_right', 'message_over')),
  text_align TEXT NOT NULL DEFAULT 'left' CHECK (text_align IN ('left', 'center')),
  headline_font TEXT NOT NULL DEFAULT 'display' CHECK (headline_font IN ('display', 'body')),
  glow_enabled BOOLEAN NOT NULL DEFAULT true,
  glow_color TEXT NOT NULL DEFAULT 'orange_gold'
    CHECK (glow_color IN ('orange', 'gold', 'orange_gold')),
  glow_strength INTEGER NOT NULL DEFAULT 50 CHECK (glow_strength BETWEEN 0 AND 100),
  glow_speed_seconds INTEGER NOT NULL DEFAULT 6 CHECK (glow_speed_seconds BETWEEN 2 AND 15),
  autoplay BOOLEAN NOT NULL DEFAULT true,
  slide_seconds INTEGER NOT NULL DEFAULT 6 CHECK (slide_seconds BETWEEN 3 AND 15),
  height_px INTEGER NOT NULL DEFAULT 360 CHECK (height_px BETWEEN 200 AND 560),
  photo_darkness INTEGER NOT NULL DEFAULT 50 CHECK (photo_darkness BETWEEN 0 AND 80),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row for each banner photo, shown in sort_order.
CREATE TABLE IF NOT EXISTS public.home_banner_slides (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL CHECK (url ~ '^https://'),
  alt TEXT NOT NULL DEFAULT '' CHECK (char_length(alt) <= 200),
  caption TEXT NOT NULL DEFAULT '' CHECK (char_length(caption) <= 80),
  link_product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_banner_slides_sort_order
  ON public.home_banner_slides(sort_order);

DROP TRIGGER IF EXISTS home_banner_updated_at ON public.home_banner;
CREATE TRIGGER home_banner_updated_at
  BEFORE UPDATE ON public.home_banner
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Ten photos at most. The admin page checks this too; this is the backstop.
CREATE OR REPLACE FUNCTION public.home_banner_slides_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.home_banner_slides) >= 10 THEN
    RAISE EXCEPTION 'The banner holds 10 photos at most.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS home_banner_slides_limit ON public.home_banner_slides;
CREATE TRIGGER home_banner_slides_limit
  BEFORE INSERT ON public.home_banner_slides
  FOR EACH ROW
  EXECUTE FUNCTION public.home_banner_slides_limit();

-- Row level security
ALTER TABLE public.home_banner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_banner_slides ENABLE ROW LEVEL SECURITY;

-- Signed-out visitors may read but never write.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.home_banner FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.home_banner_slides FROM anon;

DROP POLICY IF EXISTS "Public read home_banner" ON public.home_banner;
DROP POLICY IF EXISTS "Admin update home_banner" ON public.home_banner;
CREATE POLICY "Public read home_banner" ON public.home_banner FOR SELECT
  USING (true);
CREATE POLICY "Admin update home_banner" ON public.home_banner FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Public read home_banner_slides" ON public.home_banner_slides;
DROP POLICY IF EXISTS "Admin insert home_banner_slides" ON public.home_banner_slides;
DROP POLICY IF EXISTS "Admin update home_banner_slides" ON public.home_banner_slides;
DROP POLICY IF EXISTS "Admin delete home_banner_slides" ON public.home_banner_slides;
CREATE POLICY "Public read home_banner_slides" ON public.home_banner_slides FOR SELECT
  USING (true);
CREATE POLICY "Admin insert home_banner_slides" ON public.home_banner_slides FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin update home_banner_slides" ON public.home_banner_slides FOR UPDATE TO authenticated
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "Admin delete home_banner_slides" ON public.home_banner_slides FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- The single settings row, switched off, with every default above.
INSERT INTO public.home_banner (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
