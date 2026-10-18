"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthAction } from "@/lib/supabase/auth-guard";
import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";

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
