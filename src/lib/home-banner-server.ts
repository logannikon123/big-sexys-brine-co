import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import {
  BANNER_EVENT_COLUMNS,
  HOME_BANNER_COLUMNS,
  readBannerRow,
  type BannerEvent,
  type BannerProduct,
  type HomeBannerData,
  type HomeBannerSettings,
  type HomeBannerSlide,
} from "@/lib/home-banner";

// A Supabase client without cookies, like getSupabase() in src/lib/data.ts.
// Reading without cookies lets the home page be built ahead of time.
function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );
}

/** Supabase returns a joined row as an object, or sometimes a list of one. */
function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return (value as T | null) ?? null;
}

const _getHomeBannerUncached = async (): Promise<HomeBannerData | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = getSupabase();
    // The banner has two links to events, so each join names its column.
    const [{ data: row, error: rowError }, { data: slideRows, error: slideError }] =
      await Promise.all([
        supabase
          .from("home_banner")
          .select(
            `${HOME_BANNER_COLUMNS},
            link_product:products!link_product_id(id, name, slug),
            link_event:events!link_event_id(${BANNER_EVENT_COLUMNS}),
            picked_event:events!event_section_event_id(${BANNER_EVENT_COLUMNS})`
          )
          .eq("id", 1)
          .maybeSingle(),
        supabase
          .from("home_banner_slides")
          .select("id, url, alt, caption, link_product_id, sort_order, product:products(id, name, slug)")
          .order("sort_order")
          .order("id"),
      ]);

    // Until the database update that adds these tables is applied, both
    // reads fail. Show no banner.
    if (rowError || slideError || !row) return null;

    const { link_product, link_event, picked_event, ...settings } =
      row as unknown as HomeBannerSettings & {
        link_product: unknown;
        link_event: unknown;
        picked_event: unknown;
      };

    const slides = ((slideRows ?? []) as unknown as (HomeBannerSlide & {
      product: unknown;
    })[]).map((slide) => ({
      ...slide,
      product: one<BannerProduct>(slide.product),
    }));

    return {
      settings: readBannerRow(settings),
      slides,
      linkProduct: one<BannerProduct>(link_product),
      linkEvent: one<BannerEvent>(link_event),
      pickedEvent: one<BannerEvent>(picked_event),
    };
  } catch {
    // Supabase is down or sent something odd. The home page shows as usual.
    return null;
  }
};

/**
 * The saved banner, or null when there is none or it can't be read. Saving
 * the banner in the admin clears this cache, and so does any product or event
 * change (a renamed product changes its link). Whether the banner shows right
 * now (on, dates, the next event) is worked out outside this cache, when the
 * page loads.
 */
export const getHomeBanner = unstable_cache(_getHomeBannerUncached, ["home-banner"], {
  tags: ["home-banner", "products", "events"],
  revalidate: 60,
});
