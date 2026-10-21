"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthAction } from "@/lib/supabase/auth-guard";
import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";
import { storeSettingsSchema, type StoreSettings } from "@/lib/store-settings";
import { retailLocationSchema, type RetailLocationInput } from "@/lib/retail-locations";

/**
 * Revalidate all product-related pages and caches.
 * Uses both revalidatePath (for route cache) and revalidateTag (for data cache).
 */
function revalidateProducts(slug?: string) {
  // Revalidate the full route tree for products
  revalidatePath("/", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/admin/products", "layout");
  if (slug) {
    revalidatePath(`/products/${slug}`, "page");
  }
  // Revalidate data cache tags
  revalidateTag("products", { expire: 0 });
  revalidateTag("product-images", { expire: 0 });
}

function revalidateEvents() {
  revalidatePath("/admin/events", "layout");
  revalidatePath("/events", "layout");
  revalidatePath("/", "layout");
  revalidateTag("events", { expire: 0 });
}

function revalidateRetail() {
  revalidatePath("/admin/retail", "layout");
  revalidatePath("/events", "layout");
  revalidateTag("retail-locations", { expire: 0 });
}

function revalidateTestimonials() {
  revalidatePath("/admin/testimonials", "layout");
  revalidatePath("/", "layout");
  revalidateTag("testimonials", { expire: 0 });
}

function revalidateClassInfo() {
  revalidatePath("/admin/class", "layout");
  revalidatePath("/learn-to-preserve", "layout");
  revalidateTag("class-info", { expire: 0 });
}

function revalidateGallery() {
  revalidatePath("/admin/gallery", "layout");
  revalidatePath("/gallery", "layout");
  revalidateTag("gallery", { expire: 0 });
}

/**
 * Manually flush every cached tag and revalidate every public + admin route.
 * Use when content looks stale despite an admin save (CDN edge cache, browser
 * cache, or a missed revalidation hook).
 */
export async function clearAllCache() {
  await requireAuthAction();
  // Data cache tags
  revalidateTag("products", { expire: 0 });
  revalidateTag("product-images", { expire: 0 });
  revalidateTag("events", { expire: 0 });
  revalidateTag("retail-locations", { expire: 0 });
  revalidateTag("testimonials", { expire: 0 });
  revalidateTag("class-info", { expire: 0 });
  revalidateTag("gallery", { expire: 0 });
  // Full route tree — nukes route cache for public + admin
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}

// Categories
export async function createCategory(data: { name: string }) {
  await requireAuthAction();
  const supabase = await createClient();
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const { data: maxOrder } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const sort_order = (maxOrder?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from("categories")
    .insert({ name: data.name, slug, sort_order });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
  revalidateProducts();
}

export async function updateCategory(
  id: number,
  data: { name: string }
) {
  await requireAuthAction();
  const supabase = await createClient();
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const { error } = await supabase
    .from("categories")
    .update({ name: data.name, slug })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
  revalidateProducts();
}

export async function deleteCategory(id: number) {
  await requireAuthAction();
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
  revalidateProducts();
}

export async function updateCategoryOrder(
  items: { id: number; sort_order: number }[]
) {
  await requireAuthAction();
  const supabase = await createClient();
  for (const item of items) {
    const { error } = await supabase
      .from("categories")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/admin/categories");
  revalidateProducts();
}

// Products
export async function createProduct(data: {
  name: string;
  slug: string;
  size: string;
  tagline: string;
  description: string;
  ingredients: string[];
  heat: number;
  category: string;
  category_ids: number[];
  image_url: string | null;
  featured: boolean;
  price_cents: number | null;
  sold_online: boolean;
  sold_out: boolean;
  images?: { url: string; alt: string | null; sort_order: number; is_primary: boolean }[];
}) {
  await requireAuthAction();
  const supabase = await createClient();
  const { category_ids, images, ...productData } = data;

  // If we have gallery images, use the primary image as image_url
  if (images && images.length > 0) {
    const primary = images.find((img) => img.is_primary) ?? images[0];
    productData.image_url = primary.url;
  }

  // One database call saves the product, its categories and its photos
  // together (see the save_product migration), so a failure can't leave
  // half a save behind.
  const { error } = await supabase.rpc("save_product", {
    p_id: null,
    p_product: productData,
    p_category_ids: category_ids,
    p_images: images ?? [],
  });
  if (error) throw new Error(error.message);

  revalidateProducts(data.slug);
}

export async function updateProduct(
  id: number,
  data: {
    name: string;
    slug: string;
    size: string;
    tagline: string;
    description: string;
    ingredients: string[];
    heat: number;
    category: string;
    category_ids: number[];
    image_url: string | null;
    featured: boolean;
    price_cents: number | null;
    sold_online: boolean;
    sold_out: boolean;
    images?: { url: string; alt: string | null; sort_order: number; is_primary: boolean }[];
  }
) {
  await requireAuthAction();
  const supabase = await createClient();
  const { category_ids, images, ...productData } = data;

  // If we have gallery images, use the primary image as image_url
  if (images && images.length > 0) {
    const primary = images.find((img) => img.is_primary) ?? images[0];
    productData.image_url = primary.url;
  }

  // One database call saves the product, its categories and its photos
  // together (see the save_product migration), so a failure can't leave a
  // product with no categories or no photos. Leaving images out keeps the
  // current photos.
  const { error } = await supabase.rpc("save_product", {
    p_id: id,
    p_product: productData,
    p_category_ids: category_ids,
    p_images: images ?? null,
  });
  if (error) throw new Error(error.message);

  revalidateProducts(data.slug);
}

export async function deleteProduct(id: number) {
  await requireAuthAction();
  const supabase = await createClient();
  // product_images will cascade delete due to ON DELETE CASCADE
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateProducts();
}

export async function updateProductOrder(items: { id: number; sort_order: number }[]) {
  await requireAuthAction();
  const supabase = await createClient();
  for (const item of items) {
    const { error } = await supabase
      .from("products")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
  }
  revalidateProducts();
}

// Events
export async function createEvent(data: {
  name: string;
  date: string;
  end_date: string | null;
  is_recurring: boolean;
  recurrence_day: string | null;
  time: string;
  location: string;
  address: string | null;
  type: string;
  description: string | null;
}) {
  await requireAuthAction();
  const supabase = await createClient();
  const { data: maxOrder } = await supabase
    .from("events")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const sort_order = (maxOrder?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("events").insert({ ...data, sort_order });
  if (error) throw new Error(error.message);
  revalidateEvents();
}

export async function updateEvent(
  id: number,
  data: {
    name: string;
    date: string;
    end_date: string | null;
    is_recurring: boolean;
    recurrence_day: string | null;
    time: string;
    location: string;
    address: string | null;
    type: string;
    description: string | null;
  }
) {
  await requireAuthAction();
  const supabase = await createClient();
  const { error } = await supabase.from("events").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateEvents();
}

export async function deleteEvent(id: number) {
  await requireAuthAction();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateEvents();
}

export async function updateEventOrder(items: { id: number; sort_order: number }[]) {
  await requireAuthAction();
  const supabase = await createClient();
  for (const item of items) {
    const { error } = await supabase
      .from("events")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
  }
  revalidateEvents();
}

// Retail locations (stores that carry the jars, on the Find Us page)
function parseRetailLocation(data: RetailLocationInput) {
  const parsed = retailLocationSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Check the form.");
  }
  return parsed.data;
}

export async function createRetailLocation(data: RetailLocationInput) {
  await requireAuthAction();
  const row = parseRetailLocation(data);
  const supabase = await createClient();
  const { data: maxOrder } = await supabase
    .from("retail_locations")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxOrder?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("retail_locations").insert({ ...row, sort_order });
  if (error) throw new Error(error.message);
  revalidateRetail();
}

export async function updateRetailLocation(id: number, data: RetailLocationInput) {
  await requireAuthAction();
  const row = parseRetailLocation(data);
  const supabase = await createClient();
  const { error } = await supabase.from("retail_locations").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRetail();
}

export async function deleteRetailLocation(id: number) {
  await requireAuthAction();
  const supabase = await createClient();
  const { error } = await supabase.from("retail_locations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRetail();
}

export async function updateRetailLocationOrder(items: { id: number; sort_order: number }[]) {
  await requireAuthAction();
  const supabase = await createClient();
  for (const item of items) {
    const { error } = await supabase
      .from("retail_locations")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
  }
  revalidateRetail();
}

// Testimonials
export async function createTestimonial(data: {
  quote: string;
  author: string;
  product: string | null;
}) {
  await requireAuthAction();
  const supabase = await createClient();
  const { data: maxOrder } = await supabase
    .from("testimonials")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const sort_order = (maxOrder?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("testimonials").insert({ ...data, sort_order });
  if (error) throw new Error(error.message);
  revalidateTestimonials();
}

export async function updateTestimonial(
  id: number,
  data: {
    quote: string;
    author: string;
    product: string | null;
  }
) {
  await requireAuthAction();
  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTestimonials();
}

export async function deleteTestimonial(id: number) {
  await requireAuthAction();
  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTestimonials();
}

export async function updateTestimonialOrder(items: { id: number; sort_order: number }[]) {
  await requireAuthAction();
  const supabase = await createClient();
  for (const item of items) {
    const { error } = await supabase
      .from("testimonials")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
  }
  revalidateTestimonials();
}

// Class Info
export async function updateClassInfo(data: {
  title: string;
  price: number;
  duration: string;
  description: string;
  what_you_learn: string[];
  what_you_get: string[];
  max_students: number;
}) {
  await requireAuthAction();
  const supabase = await createClient();
  const { error } = await supabase.from("class_info").update(data).eq("id", 1);
  if (error) throw new Error(error.message);
  revalidateClassInfo();
}

// Store settings
/**
 * Save the single store settings row. Returns an error message instead of
 * throwing, because the live site hides thrown messages and Jesse needs to
 * see which setting to fix.
 */
export async function updateStoreSettings(
  data: StoreSettings
): Promise<{ error?: string }> {
  await requireAuthAction();
  const parsed = storeSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Those settings aren't valid." };
  }
  const supabase = await createClient();

  // Delivery prices depend on distance from the starting point, so the store
  // can't open with delivery on until the starting point is saved.
  if (parsed.data.orders_open && parsed.data.delivery_enabled) {
    const { data: origin } = await supabase
      .from("store_private_settings")
      .select("delivery_origin_lat")
      .eq("id", 1)
      .maybeSingle();
    if (origin?.delivery_origin_lat == null) {
      return {
        error:
          "Local delivery is on, but the delivery starting point isn't saved yet. Save your address below, or turn delivery off.",
      };
    }
  }

  const { data: saved, error } = await supabase
    .from("store_settings")
    .update(parsed.data)
    .eq("id", 1)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) {
    return { error: "The store settings weren't saved. The settings row is missing, or this account can't change it." };
  }
  revalidatePath("/admin/store");
  // The public pages show or hide the cart depending on these settings.
  revalidatePath("/", "layout");
  revalidateTag("store-settings", { expire: 0 });
  return {};
}

interface CensusMatch {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
}

/**
 * Save the address delivery distance is measured from. The free US Census
 * geocoder turns it into a map position (latitude and longitude). Returns the
 * address the Census matched, so the admin can check it is the right place.
 */
export async function updateDeliveryOrigin(
  address: string
): Promise<{ matchedAddress?: string; error?: string }> {
  await requireAuthAction();
  const typed = typeof address === "string" ? address.trim() : "";
  if (typed === "") return { error: "Type an address first." };
  if (typed.length > 200) return { error: "That address is too long." };

  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress" +
    `?address=${encodeURIComponent(typed)}&benchmark=Public_AR_Current&format=json`;

  let matches: CensusMatch[];
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { error: "The address lookup service isn't answering. Try again in a few minutes." };
    }
    const body = await res.json();
    matches = body?.result?.addressMatches ?? [];
  } catch {
    return { error: "The address lookup service isn't answering. Try again in a few minutes." };
  }

  if (matches.length === 0) {
    return {
      error:
        "No match for that address. Check the spelling and include the street, city, state and ZIP code.",
    };
  }
  if (matches.length > 1) {
    return {
      error:
        "That address matches more than one place. Add the city, state and ZIP code so it matches just one.",
    };
  }

  const match = matches[0];
  const lat = match.coordinates?.y;
  const lon = match.coordinates?.x;
  const matchedAddress = match.matchedAddress;
  if (typeof lat !== "number" || typeof lon !== "number" || !matchedAddress) {
    return { error: "The address lookup gave an answer the site can't read. Try again later." };
  }

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("store_private_settings")
    .update({
      delivery_origin_address: typed,
      delivery_origin_lat: lat,
      delivery_origin_lon: lon,
      delivery_origin_matched_address: matchedAddress,
    })
    .eq("id", 1)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) {
    return { error: "The address wasn't saved. The private settings row is missing, or this account can't change it." };
  }
  revalidatePath("/admin/store");
  return { matchedAddress };
}

// Gallery
export async function createGalleryImage(data: {
  url: string;
  alt: string | null;
  sort_order: number;
}) {
  await requireAuthAction();
  const supabase = await createClient();
  const { error } = await supabase.from("gallery_images").insert(data);
  if (error) throw new Error(error.message);
  revalidateGallery();
}

export async function updateGalleryOrder(items: { id: number; sort_order: number }[]) {
  await requireAuthAction();
  const supabase = await createClient();
  for (const item of items) {
    const { error } = await supabase
      .from("gallery_images")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
  }
  revalidateGallery();
}

export async function deleteGalleryImage(id: number) {
  await requireAuthAction();
  const supabase = await createClient();
  const { error } = await supabase.from("gallery_images").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateGallery();
}
