import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuoteTaxPart } from "@/lib/checkout/quote";

/**
 * Save an order's tax split by city and county (the order_tax_parts table),
 * for the tax report at /admin/sales/tax. Checkout calls this with the
 * service role client right after it saves the order and its jars.
 *
 * The order and its total tax are already saved, so a failure here doesn't
 * stop the payment: it only means the report shows this order in the
 * "city and county not recorded" line, using its saved jurisdiction text.
 * The failure is logged so it can be found.
 */
export async function saveTaxParts(
  supabase: SupabaseClient,
  orderId: string,
  parts: readonly QuoteTaxPart[]
): Promise<void> {
  // Orders that paid 0% because no rate was on file have no parts.
  if (parts.length === 0) return;
  const { error } = await supabase.from("order_tax_parts").insert(
    parts.map((part) => ({
      order_id: orderId,
      food_tax_rate_id: part.foodTaxRateId,
      kind: part.kind,
      name: part.name,
      census_geoid: part.censusGeoid,
      collected_by: part.collectedBy,
      rate_bps: part.rateBps,
      taxable_cents: part.taxableCents,
      tax_cents: part.taxCents,
    }))
  );
  if (error) console.error("Pay: couldn't save the order's tax split:", error.message);
}
