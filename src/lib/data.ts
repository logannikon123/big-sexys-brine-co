import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Product, ProductImage, Event, ClassInfo, Testimonial, RetailLocation } from "@/types";
import type { StoreSettings } from "@/lib/store-settings";

// Fallback to JSON files if Supabase is not configured
const useSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// Use a direct Supabase client (no cookies) for data fetching.
// This avoids the "cookies was called outside a request scope" error
// during static generation (generateStaticParams / generateMetadata).
function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );
}

// Products
const _getProductsUncached = async (): Promise<Product[]> => {
  if (!useSupabase) {
    const data = (await import("@/content/products.json")).default;
    return data as Product[];
  }
  const supabase = getSupabase();
  const { data } = await supabase.from("products").select("*").order("sort_order");
  const products = (data ?? []).map(mapProduct);
  // Fetch all product images in one query
  const productIds = products.map((p) => p.id);
  if (productIds.length > 0) {
    const { data: allImages } = await supabase
      .from("product_images")
      .select("*")
      .in("product_id", productIds)
      .order("sort_order");
    if (allImages) {
      const imagesByProduct = new Map<number, ProductImage[]>();
      for (const img of allImages) {
        const list = imagesByProduct.get(img.product_id) ?? [];
        list.push({
          id: img.id,
          url: img.url,
          alt: img.alt,
          sort_order: img.sort_order,
          is_primary: img.is_primary,
        });
        imagesByProduct.set(img.product_id, list);
      }
      for (const product of products) {
        product.images = imagesByProduct.get(product.id) ?? [];
      }
    }
  }
  return products;
};

export const getProducts = unstable_cache(
  _getProductsUncached,
  ["products-all"],
  { tags: ["products", "product-images"], revalidate: 60 }
);

const _getProductBySlugUncached = async (
  slug: string
): Promise<Product | undefined> => {
  if (!useSupabase) {
    const data = (await import("@/content/products.json")).default;
    return (data as Product[]).find((p) => p.slug === slug);
  }
  const supabase = getSupabase();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!data) return undefined;
  const product = mapProduct(data);
  // Fetch product images
  const { data: images } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", product.id)
    .order("sort_order");
  if (images && images.length > 0) {
    product.images = images.map((img: Record<string, unknown>) => ({
      id: img.id as number,
      url: img.url as string,
      alt: img.alt as string | null,
      sort_order: img.sort_order as number,
      is_primary: img.is_primary as boolean,
    }));
  }
  return product;
};

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const cachedFn = unstable_cache(
    () => _getProductBySlugUncached(slug),
    [`product-${slug}`],
    { tags: ["products", "product-images"], revalidate: 60 }
  );
  return cachedFn();
}

const _getFeaturedProductsUncached = async (): Promise<Product[]> => {
  if (!useSupabase) {
    const data = (await import("@/content/products.json")).default;
    return (data as Product[]).filter((p) => p.featured);
  }
  const supabase = getSupabase();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("featured", true)
    .order("sort_order");
  return (data ?? []).map(mapProduct);
};

export const getFeaturedProducts = unstable_cache(
  _getFeaturedProductsUncached,
  ["products-featured"],
  { tags: ["products"], revalidate: 60 }
);

export async function getProductsByCategory(
  category: string
): Promise<Product[]> {
  if (category === "All") return getProducts();
  const cachedFn = unstable_cache(
    async () => {
      if (!useSupabase) {
        const data = (await import("@/content/products.json")).default;
        return (data as Product[]).filter((p) => p.category === category);
      }
      const supabase = getSupabase();
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("category", category)
        .order("sort_order");
      return (data ?? []).map(mapProduct);
    },
    [`products-category-${category}`],
    { tags: ["products"], revalidate: 60 }
  );
  return cachedFn();
}

const _getProductCategoriesUncached = async (): Promise<string[]> => {
  if (!useSupabase) {
    const products = await getProducts();
    const categories = new Set(products.map((p) => p.category));
    return ["All", ...Array.from(categories)];
  }
  const supabase = getSupabase();
  const { data } = await supabase
    .from("categories")
    .select("name")
    .order("sort_order");
  return ["All", ...(data ?? []).map((c: { name: string }) => c.name)];
};

export const getProductCategories = unstable_cache(
  _getProductCategoriesUncached,
  ["product-categories"],
  { tags: ["products"], revalidate: 60 }
);

export async function getProductsByCategories(
  categoryName: string
): Promise<Product[]> {
  if (categoryName === "All") return getProducts();
  const cachedFn = unstable_cache(
    async () => {
      if (!useSupabase) {
        const data = (await import("@/content/products.json")).default;
        return (data as Product[]).filter((p) => p.category === categoryName);
      }
      const supabase = getSupabase();
      // Get category id
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("name", categoryName)
        .single();
      if (!cat) return [];
      // Get product ids in this category
      const { data: pcs } = await supabase
        .from("product_categories")
        .select("product_id")
        .eq("category_id", cat.id);
      if (!pcs || pcs.length === 0) return [];
      const productIds = pcs.map((pc: { product_id: number }) => pc.product_id);
      const { data } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds)
        .order("sort_order");
      return (data ?? []).map(mapProduct);
    },
    [`products-by-categories-${categoryName}`],
    { tags: ["products"], revalidate: 60 }
  );
  return cachedFn();
}

// Events
const _getEventsUncached = async (): Promise<Event[]> => {
  if (!useSupabase) {
    const data = (await import("@/content/events.json")).default;
    return (data as Event[]).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }
  const supabase = getSupabase();
  const { data } = await supabase
    .from("events")
    .select("*")
    .order("sort_order");
  return (data ?? []) as Event[];
};

export const getEvents = unstable_cache(_getEventsUncached, ["events-all"], {
  tags: ["events"],
  revalidate: 60,
});

// Retail locations: stores that carry the jars. Only visible ones, in the
// admin's order. A failed read returns none, so the Find Us page still shows
// its events.
const _getRetailLocationsUncached = async (): Promise<RetailLocation[]> => {
  if (!useSupabase) {
    const data = (await import("@/content/retail-locations.json")).default;
    return (data as RetailLocation[])
      .filter((r) => r.is_visible)
      .sort((a, b) => a.sort_order - b.sort_order);
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("retail_locations")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order");
  if (error) {
    console.error("Couldn't read retail locations:", error.message);
    return [];
  }
  return (data ?? []) as RetailLocation[];
};

export const getRetailLocations = unstable_cache(
  _getRetailLocationsUncached,
  ["retail-locations-visible"],
  { tags: ["retail-locations"], revalidate: 60 }
);

export async function getUpcomingEvents(): Promise<Event[]> {
  const events = await getEvents();
  const now = new Date();
  return events.filter((e) => {
    // For recurring events with an end_date, check if end_date is in the future
    if (e.is_recurring && e.end_date) {
      return new Date(e.end_date) >= now;
    }
    // For events with end_date (multi-day), check end_date
    if (e.end_date) {
      return new Date(e.end_date) >= now;
    }
    // Otherwise check the single date
    return new Date(e.date) >= now;
  });
}

export async function getPastEvents(): Promise<Event[]> {
  const events = await getEvents();
  const now = new Date();
  return events.filter((e) => {
    if (e.is_recurring && e.end_date) {
      return new Date(e.end_date) < now;
    }
    if (e.end_date) {
      return new Date(e.end_date) < now;
    }
    return new Date(e.date) < now;
  });
}

// Class Info
const _getClassInfoUncached = async (): Promise<ClassInfo> => {
  if (!useSupabase) {
    const data = (await import("@/content/class.json")).default;
    return data as ClassInfo;
  }
  const supabase = getSupabase();
  const { data } = await supabase
    .from("class_info")
    .select("*")
    .eq("id", 1)
    .single();
  if (!data) {
    const fallback = (await import("@/content/class.json")).default;
    return fallback as ClassInfo;
  }
  return {
    title: data.title,
    price: Number(data.price),
    duration: data.duration,
    description: data.description,
    whatYouLearn: data.what_you_learn,
    whatYouGet: data.what_you_get,
    maxStudents: data.max_students,
  };
};

export const getClassInfo = unstable_cache(
  _getClassInfoUncached,
  ["class-info"],
  { tags: ["class-info"], revalidate: 60 }
);

// Testimonials
const _getTestimonialsUncached = async (): Promise<Testimonial[]> => {
  if (!useSupabase) {
    const data = (await import("@/content/testimonials.json")).default;
    return data as Testimonial[];
  }
  const supabase = getSupabase();
  const { data } = await supabase
    .from("testimonials")
    .select("*")
    .order("sort_order");
  return (data ?? []) as Testimonial[];
};

export const getTestimonials = unstable_cache(
  _getTestimonialsUncached,
  ["testimonials-all"],
  { tags: ["testimonials"], revalidate: 60 }
);

// Store settings
/** The store settings the public site needs. Anyone can read these. */
export type PublicStoreSettings = Pick<
  StoreSettings,
  | "orders_open"
  | "pickup_enabled"
  | "delivery_enabled"
  | "shipping_enabled"
  | "jars_per_box"
  | "packing_fee_per_box_cents"
  | "delivery_min_order_cents"
  | "delivery_standard_hours"
  | "rush_fee_cents"
  | "shipping_states"
  | "delivery_max_miles"
  | "delivery_step_miles"
  | "delivery_fee_per_step_cents"
  | "free_delivery_enabled"
  | "free_delivery_max_miles"
  | "free_delivery_min_order_cents"
  | "shipping_fallback_per_box_cents"
  | "shipping_cushion_per_box_cents"
>;

const _getStoreSettingsUncached = async (): Promise<PublicStoreSettings | null> => {
  if (!useSupabase) return null;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("store_settings")
    .select(
      "orders_open, pickup_enabled, delivery_enabled, shipping_enabled, jars_per_box, packing_fee_per_box_cents, delivery_min_order_cents, delivery_standard_hours, rush_fee_cents, shipping_states, delivery_max_miles, delivery_step_miles, delivery_fee_per_step_cents, free_delivery_enabled, free_delivery_max_miles, free_delivery_min_order_cents, shipping_fallback_per_box_cents, shipping_cushion_per_box_cents"
    )
    .eq("id", 1)
    .maybeSingle();
  if (!data) return null;
  // Postgres NUMERIC columns arrive as strings, like "24.0".
  const milesOrNull = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  return {
    ...data,
    delivery_max_miles: Number(data.delivery_max_miles),
    delivery_step_miles: Number(data.delivery_step_miles),
    free_delivery_max_miles: milesOrNull(data.free_delivery_max_miles),
  } as PublicStoreSettings;
};

/** Store settings, or null if they can't be read. Saving them in the admin clears this cache. */
export const getStoreSettings = unstable_cache(
  _getStoreSettingsUncached,
  ["store-settings"],
  { tags: ["store-settings"], revalidate: 60 }
);

/**
 * True when customers can add jars to a cart: the admin has opened the
 * store, or this computer previews ordering with
 * NEXT_PUBLIC_ORDERING_PREVIEW=true (local preview only, never set in Vercel).
 */
export async function getOrderingAvailable(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_ORDERING_PREVIEW === "true") return true;
  const settings = await getStoreSettings();
  return settings?.orders_open === true;
}

// Helper to map Supabase product row to Product type
function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    name: row.name as string,
    slug: row.slug as string,
    size: row.size as string,
    tagline: row.tagline as string,
    description: row.description as string,
    ingredients: row.ingredients as string[],
    heat: row.heat as number,
    category: row.category as Product["category"],
    image: (row.image_url as string) ?? (row.image as string) ?? "",
    featured: row.featured as boolean | undefined,
    priceCents: (row.price_cents as number | null | undefined) ?? null,
    soldOnline: (row.sold_online as boolean | undefined) ?? false,
    soldOut: (row.sold_out as boolean | undefined) ?? false,
  };
}
