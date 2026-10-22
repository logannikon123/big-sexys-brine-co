-- Product prices and online-sale switches (online ordering, step 1).
--
-- Until now each price lived only inside the free-text size label, for example
-- "16oz (1/2QT) $15". This adds a real price, stored in cents so money math
-- stays exact, plus two switches:
--   sold_online: the product can be ordered online (needs a price)
--   sold_out:    temporarily unavailable online
-- Nothing on the public site uses these yet.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  ADD COLUMN IF NOT EXISTS sold_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sold_out boolean NOT NULL DEFAULT false;

-- Fill in each price from the "$15" or "$25" at the end of its size label,
-- and mark priced products as sold online. Online prices match market prices.
UPDATE public.products
SET
  price_cents = round(substring(size FROM '\$(\d+(?:\.\d{1,2})?)')::numeric * 100)::integer,
  sold_online = true
WHERE price_cents IS NULL AND size ~ '\$\d';

ALTER TABLE public.products
  ADD CONSTRAINT products_online_needs_price CHECK (NOT sold_online OR price_cents IS NOT NULL);

-- save_product now also saves the price and the two switches. On update, each
-- of the three is changed only when the admin sends it, so a save that leaves
-- them out can't wipe a price.
CREATE OR REPLACE FUNCTION public.save_product(
  p_id integer,
  p_product jsonb,
  p_category_ids integer[],
  p_images jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_id integer := p_id;
  v_ingredients text[] := coalesce(
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_product -> 'ingredients', '[]'::jsonb))),
    '{}'
  );
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can save products' USING ERRCODE = '42501';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.products
      (name, slug, size, tagline, description, ingredients, heat, category, image_url, featured,
       price_cents, sold_online, sold_out, sort_order)
    VALUES (
      p_product ->> 'name',
      p_product ->> 'slug',
      p_product ->> 'size',
      p_product ->> 'tagline',
      p_product ->> 'description',
      v_ingredients,
      coalesce((p_product ->> 'heat')::integer, 0),
      p_product ->> 'category',
      p_product ->> 'image_url',
      coalesce((p_product ->> 'featured')::boolean, false),
      (p_product ->> 'price_cents')::integer,
      coalesce((p_product ->> 'sold_online')::boolean, false),
      coalesce((p_product ->> 'sold_out')::boolean, false),
      (SELECT coalesce(max(sort_order), -1) + 1 FROM public.products)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.products SET
      name = p_product ->> 'name',
      slug = p_product ->> 'slug',
      size = p_product ->> 'size',
      tagline = p_product ->> 'tagline',
      description = p_product ->> 'description',
      ingredients = v_ingredients,
      heat = coalesce((p_product ->> 'heat')::integer, 0),
      category = p_product ->> 'category',
      image_url = p_product ->> 'image_url',
      featured = coalesce((p_product ->> 'featured')::boolean, false),
      price_cents = CASE WHEN p_product ? 'price_cents'
        THEN (p_product ->> 'price_cents')::integer ELSE price_cents END,
      sold_online = CASE WHEN p_product ? 'sold_online'
        THEN coalesce((p_product ->> 'sold_online')::boolean, false) ELSE sold_online END,
      sold_out = CASE WHEN p_product ? 'sold_out'
        THEN coalesce((p_product ->> 'sold_out')::boolean, false) ELSE sold_out END
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_id USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.product_categories WHERE product_id = v_id;
  INSERT INTO public.product_categories (product_id, category_id)
  SELECT DISTINCT v_id, cid FROM unnest(coalesce(p_category_ids, '{}')) AS cid;

  IF p_images IS NOT NULL THEN
    DELETE FROM public.product_images WHERE product_id = v_id;
    INSERT INTO public.product_images (product_id, url, alt, sort_order, is_primary)
    SELECT
      v_id,
      img ->> 'url',
      img ->> 'alt',
      coalesce((img ->> 'sort_order')::integer, 0),
      coalesce((img ->> 'is_primary')::boolean, false)
    FROM jsonb_array_elements(p_images) AS img;
  END IF;

  RETURN v_id;
END;
$$;
