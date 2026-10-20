import "server-only";

/**
 * Local food sales tax for an address, found from its Census city and
 * county codes.
 *
 * This file is a stand-in. A separate change adds the food tax table and
 * src/lib/food-tax.ts with a lookupFoodTax function of this same shape. When
 * that change is merged, this function will call it. Until then every lookup
 * answers "unknown", so each quote shows tax as "to be confirmed" and
 * charges none.
 */

export interface FoodTaxQuery {
  /** Census place code of the city or town, or null outside any town. */
  placeGeoid: string | null;
  /** Census state and county code, like "08059". */
  countyFips: string | null;
}

export interface FoodTaxLookup {
  /**
   * ok: the rate is known and confirmed.
   * unconfirmed: a rate is on file but not yet checked.
   * unknown: no rate on file for this place.
   */
  status: "ok" | "unconfirmed" | "unknown";
  /** Combined local food tax rate, in hundredths of a percent (400 = 4.00%). */
  rateBps?: number;
  /** Who collects it, like "Wheat Ridge + Jefferson County". */
  jurisdiction?: string;
  /** True when the address may sit inside a special tax district we can't map yet. */
  maybeInDistrict?: boolean;
}

export async function lookupFoodTax(query: FoodTaxQuery): Promise<FoodTaxLookup> {
  void query;
  return { status: "unknown" };
}
