"use server";

/**
 * Changes to the food tax rates table from /admin/tax. The database lets
 * only admins write to it; these actions check the same thing first and
 * return { error } with a plain message when something goes wrong.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthAction } from "@/lib/supabase/auth-guard";
import { foodTaxRateSchema, type FoodTaxRateInput } from "@/lib/food-tax-rates";

type ActionResult = { error?: string };

const NOT_FOUND = "That row wasn't found. Reload the page and try again.";

function isRowId(id: unknown): id is number {
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0;
}

/** Turn a database error into something Jesse can act on. */
function explain(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("census_geoid")) {
      return "Another row already uses that Census code. Each county and city can appear only once.";
    }
    return "Another row already has that name and type.";
  }
  if (error.code === "23514") {
    return "The database turned that down. Check the Census code and that a place that doesn't tax food has a 0% rate.";
  }
  return error.message;
}

function parse(data: FoodTaxRateInput) {
  const parsed = foodTaxRateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That row isn't valid." } as const;
  }
  return { row: parsed.data } as const;
}

export async function createFoodTaxRate(data: FoodTaxRateInput): Promise<ActionResult> {
  await requireAuthAction();
  const result = parse(data);
  if ("error" in result) return { error: result.error };

  const supabase = await createClient();
  const { error } = await supabase.from("food_tax_rates").insert(result.row);
  if (error) return { error: explain(error) };

  revalidatePath("/admin/tax");
  return {};
}

export async function updateFoodTaxRate(
  id: number,
  data: FoodTaxRateInput
): Promise<ActionResult> {
  await requireAuthAction();
  if (!isRowId(id)) return { error: NOT_FOUND };
  const result = parse(data);
  if ("error" in result) return { error: result.error };

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("food_tax_rates")
    .update(result.row)
    .eq("id", id)
    .select("id");
  if (error) return { error: explain(error) };
  if (!saved || saved.length === 0) return { error: NOT_FOUND };

  revalidatePath("/admin/tax");
  return {};
}

export async function setFoodTaxConfirmed(
  id: number,
  confirmed: boolean
): Promise<ActionResult> {
  await requireAuthAction();
  if (!isRowId(id) || typeof confirmed !== "boolean") return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("food_tax_rates")
    .update({ confirmed })
    .eq("id", id)
    .select("id");
  if (error) return { error: explain(error) };
  if (!saved || saved.length === 0) return { error: NOT_FOUND };

  revalidatePath("/admin/tax");
  return {};
}

export async function deleteFoodTaxRate(id: number): Promise<ActionResult> {
  await requireAuthAction();
  if (!isRowId(id)) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("food_tax_rates")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: explain(error) };
  if (!deleted || deleted.length === 0) return { error: NOT_FOUND };

  revalidatePath("/admin/tax");
  return {};
}
