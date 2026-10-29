-- Stock counts for products, so online orders can't sell more jars than
-- Jesse has.
--
-- products.stock_count: jars on hand. Null means "don't track", and the
--   product works as before (only the sold_out switch stops orders).
-- products.low_stock_at: alert Jesse when the count drops to this or lower.
--   Null means no alert.
--
-- Checkout takes the jars off the count before it charges the card
-- (take_order_stock), all or nothing, with the product rows locked, so two
-- orders can never both get the last jar. If the card then fails, the jars
-- go back (return_order_stock). A refund or a cancel does not put jars back
-- by itself: Jesse presses "Put jars back" on the admin order page, which
-- calls return_order_stock.
--
-- orders.stock_taken_at / stock_returned_at: when the jars came off and went
--   back. They make both functions safe to call twice: a second call does
--   nothing.
-- order_items.stock_taken: how many jars this line took off the count. Null
--   when the product wasn't tracked. Putting jars back adds exactly this.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_count integer
    CONSTRAINT products_stock_count_not_negative CHECK (stock_count IS NULL OR stock_count >= 0),
  ADD COLUMN IF NOT EXISTS low_stock_at integer
    CONSTRAINT products_low_stock_at_not_negative CHECK (low_stock_at IS NULL OR low_stock_at >= 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_taken_at timestamptz,
  ADD COLUMN IF NOT EXISTS stock_returned_at timestamptz;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS stock_taken integer
    CONSTRAINT order_items_stock_taken_not_negative CHECK (stock_taken IS NULL OR stock_taken >= 0);

-- Take an order's jars off the stock counts. Called by checkout and the
-- Square webhook with the service role key.
--
-- p_allow_short false (checkout, before charging): all or nothing. If any
--   tracked product has fewer jars than the order wants, nothing changes and
--   the answer lists the short lines.
-- p_allow_short true (an order already paid that never took its jars): take
--   what is there, never below 0, and list what was short so Jesse hears.
--
-- A count that reaches 0 also turns on sold_out.
--
-- Answers with JSON:
--   status:   "taken", "already" (taken before and not put back), "short"
--             or "not_found"
--   short:    [{product_id, name, available, wanted}]
--   products: [{product_id, name, stock_count, low_stock_at, taken}] for the
--             tracked products, counts after the change
CREATE OR REPLACE FUNCTION public.take_order_stock(
  p_order_id uuid,
  p_allow_short boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_line record;
  v_short jsonb := '[]'::jsonb;
  v_products jsonb := '[]'::jsonb;
  v_take integer;
  v_left integer;
BEGIN
  -- Lock the order first, so two calls for the same order run one at a time.
  SELECT id, stock_taken_at, stock_returned_at INTO v_order
  FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_order.stock_taken_at IS NOT NULL AND v_order.stock_returned_at IS NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  -- Lock the tracked products in id order (so two orders never wait on each
  -- other in a circle) and check each has enough. After a wait, Postgres
  -- reads the newest count, so a second order sees the first one's jars gone.
  FOR v_line IN
    SELECT p.id, p.name, p.stock_count, w.qty
    FROM public.products p
    JOIN (
      SELECT product_id, sum(quantity)::integer AS qty
      FROM public.order_items
      WHERE order_id = p_order_id AND product_id IS NOT NULL
      GROUP BY product_id
    ) w ON w.product_id = p.id
    WHERE p.stock_count IS NOT NULL
    ORDER BY p.id
    FOR UPDATE OF p
  LOOP
    IF v_line.stock_count < v_line.qty THEN
      v_short := v_short || jsonb_build_object(
        'product_id', v_line.id,
        'name', v_line.name,
        'available', v_line.stock_count,
        'wanted', v_line.qty
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_short) > 0 AND NOT p_allow_short THEN
    RETURN jsonb_build_object('status', 'short', 'short', v_short);
  END IF;

  -- Untracked lines took nothing.
  UPDATE public.order_items SET stock_taken = NULL WHERE order_id = p_order_id;

  FOR v_line IN
    SELECT p.id, p.name, p.stock_count, p.low_stock_at, w.qty, w.first_item
    FROM public.products p
    JOIN (
      SELECT product_id, sum(quantity)::integer AS qty, min(id) AS first_item
      FROM public.order_items
      WHERE order_id = p_order_id AND product_id IS NOT NULL
      GROUP BY product_id
    ) w ON w.product_id = p.id
    WHERE p.stock_count IS NOT NULL
    ORDER BY p.id
  LOOP
    v_take := least(v_line.qty, v_line.stock_count);
    v_left := v_line.stock_count - v_take;
    UPDATE public.products
    SET stock_count = v_left,
        sold_out = CASE WHEN v_left = 0 THEN true ELSE sold_out END
    WHERE id = v_line.id;
    -- Checkout allows one line per product; if there were more, the first
    -- line carries the whole amount so putting back adds it once.
    UPDATE public.order_items
    SET stock_taken = CASE WHEN id = v_line.first_item THEN v_take ELSE 0 END
    WHERE order_id = p_order_id AND product_id = v_line.id;
    v_products := v_products || jsonb_build_object(
      'product_id', v_line.id,
      'name', v_line.name,
      'stock_count', v_left,
      'low_stock_at', v_line.low_stock_at,
      'taken', v_take
    );
  END LOOP;

  UPDATE public.orders
  SET stock_taken_at = now(), stock_returned_at = NULL
  WHERE id = p_order_id;

  RETURN jsonb_build_object('status', 'taken', 'short', v_short, 'products', v_products);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.take_order_stock(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_order_stock(uuid, boolean) TO service_role;

-- Put an order's jars back on the stock counts: exactly what it took. A
-- count that goes from 0 back above 0 turns sold_out off again.
--
-- Checkout and the webhook call it with the service role key when a card
-- fails. Admins reach it through admin_return_order_stock (below).
--
-- Answers with JSON:
--   status:   "returned", "already" (put back before), "not_taken" or
--             "not_found"
--   products: [{product_id, name, stock_count, returned}]
CREATE OR REPLACE FUNCTION public.return_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_line record;
  v_products jsonb := '[]'::jsonb;
BEGIN
  SELECT id, stock_taken_at, stock_returned_at INTO v_order
  FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_order.stock_taken_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_taken');
  END IF;
  IF v_order.stock_returned_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  FOR v_line IN
    SELECT p.id, p.name, p.stock_count, w.qty
    FROM public.products p
    JOIN (
      SELECT product_id, sum(stock_taken)::integer AS qty
      FROM public.order_items
      WHERE order_id = p_order_id AND product_id IS NOT NULL AND stock_taken > 0
      GROUP BY product_id
    ) w ON w.product_id = p.id
    ORDER BY p.id
    FOR UPDATE OF p
  LOOP
    -- A product Jesse stopped tracking since stays untracked.
    IF v_line.stock_count IS NOT NULL THEN
      UPDATE public.products
      SET stock_count = v_line.stock_count + v_line.qty,
          sold_out = CASE WHEN v_line.stock_count = 0 THEN false ELSE sold_out END
      WHERE id = v_line.id;
      v_products := v_products || jsonb_build_object(
        'product_id', v_line.id,
        'name', v_line.name,
        'stock_count', v_line.stock_count + v_line.qty,
        'returned', v_line.qty
      );
    END IF;
  END LOOP;

  UPDATE public.orders SET stock_returned_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('status', 'returned', 'products', v_products);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.return_order_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_order_stock(uuid) TO service_role;

-- The "Put jars back" button on the admin order page. Admins can't change
-- the stock columns on orders themselves, so this runs with the owner's
-- rights (SECURITY DEFINER), after checking the caller is an admin.
CREATE OR REPLACE FUNCTION public.admin_return_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can put jars back' USING ERRCODE = '42501';
  END IF;
  RETURN public.return_order_stock(p_order_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_return_order_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_return_order_stock(uuid) TO authenticated;

-- save_product now also saves the stock count and the alert level. On
-- update, each is changed only when the admin form sends it. The form sends
-- the count only when Jesse changed it, so a save can't undo jars that
-- orders took while the form was open.
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
       price_cents, sold_online, sold_out, stock_count, low_stock_at, sort_order)
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
      (p_product ->> 'stock_count')::integer,
      (p_product ->> 'low_stock_at')::integer,
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
        THEN coalesce((p_product ->> 'sold_out')::boolean, false) ELSE sold_out END,
      stock_count = CASE WHEN p_product ? 'stock_count'
        THEN (p_product ->> 'stock_count')::integer ELSE stock_count END,
      low_stock_at = CASE WHEN p_product ? 'low_stock_at'
        THEN (p_product ->> 'low_stock_at')::integer ELSE low_stock_at END
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
