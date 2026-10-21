"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthAction } from "@/lib/supabase/auth-guard";
import {
  MAX_SLIDES,
  bannerReadyProblem,
  homeBannerSchema,
  slideSchema,
  tidyBannerSettings,
  type HomeBannerSettings,
  type HomeBannerSlide,
  type SlideInput,
} from "@/lib/home-banner";

// Each action returns an error message instead of throwing, because the live
// site hides thrown messages and Jesse needs to see what to fix.

type Result = { error?: string };

/** Banner photos live in the "images" bucket, in the banner/ folder. */
const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/`;

function revalidateBanner() {
  revalidatePath("/admin/banner");
  revalidatePath("/");
  revalidateTag("home-banner", { expire: 0 });
}

const NOT_SET_UP =
  "The banner isn't set up in the database yet. It arrives with the home banner database update.";

/** Save the banner settings (everything except the photos). */
export async function updateHomeBanner(data: HomeBannerSettings): Promise<Result> {
  await requireAuthAction();
  const parsed = homeBannerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Those settings aren't valid." };
  }
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("home_banner_slides")
    .select("id", { count: "exact", head: true });
  if (countError) return { error: NOT_SET_UP };
  const notReady = bannerReadyProblem(parsed.data, count ?? 0);
  if (notReady) return { error: notReady };

  const { data: saved, error } = await supabase
    .from("home_banner")
    .update(tidyBannerSettings(parsed.data))
    .eq("id", 1)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) {
    return { error: "The banner wasn't saved. The settings row is missing, or this account can't change it." };
  }
  revalidateBanner();
  return {};
}

/**
 * Add a photo the browser has already uploaded to banner/ in Storage.
 * Returns the new row so the page can show it straight away.
 */
export async function addBannerSlide(input: {
  url: string;
  alt: string;
}): Promise<Result & { slide?: HomeBannerSlide }> {
  await requireAuthAction();
  if (typeof input.url !== "string" || !input.url.startsWith(`${STORAGE_PREFIX}banner/`)) {
    return { error: "Banner photos must be uploaded on this page." };
  }
  const parsed = slideSchema.safeParse({
    alt: input.alt,
    caption: "",
    link_product_id: null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Describe the photo." };
  }
  const supabase = await createClient();

  const { data: last, error: lastError } = await supabase
    .from("home_banner_slides")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) return { error: NOT_SET_UP };
  const { count } = await supabase
    .from("home_banner_slides")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_SLIDES) {
    return { error: `The banner holds ${MAX_SLIDES} photos at most. Delete one first.` };
  }

  const { data: slide, error } = await supabase
    .from("home_banner_slides")
    .insert({ ...parsed.data, url: input.url, sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id, url, alt, caption, link_product_id, sort_order")
    .single();
  if (error) return { error: error.message };
  revalidateBanner();
  return { slide: slide as HomeBannerSlide };
}

/** Change a photo's description, caption or product link. */
export async function updateBannerSlide(id: number, input: SlideInput): Promise<Result> {
  await requireAuthAction();
  const parsed = slideSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the photo details." };
  }
  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("home_banner_slides")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) return { error: "That photo is gone. Reload the page." };
  revalidateBanner();
  return {};
}

/** Save a new photo order. */
export async function reorderBannerSlides(
  items: { id: number; sort_order: number }[]
): Promise<Result> {
  await requireAuthAction();
  const supabase = await createClient();
  for (const item of items) {
    const { error } = await supabase
      .from("home_banner_slides")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
    if (error) return { error: error.message };
  }
  revalidateBanner();
  return {};
}

/** Delete a photo, and its file in Storage when it lives in banner/. */
export async function deleteBannerSlide(id: number): Promise<Result> {
  await requireAuthAction();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("home_banner_slides")
    .delete()
    .eq("id", id)
    .select("url");
  if (error) return { error: error.message };

  const url = rows?.[0]?.url as string | undefined;
  if (url?.startsWith(`${STORAGE_PREFIX}banner/`)) {
    const path = decodeURIComponent(url.slice(STORAGE_PREFIX.length));
    // If this fails the photo is still off the banner; the file just stays.
    await supabase.storage.from("images").remove([path]);
  }
  revalidateBanner();
  return {};
}
