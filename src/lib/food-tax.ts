import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { FoodTaxCollector, FoodTaxKind } from "@/lib/food-tax-rates";

/**
 * Local sales tax on food for one delivery or shipping address.
 *
 * Colorado's state tax, RTD and SCFD don't tax food for home use, so only
 * the address's city and county can. The rates live in the food_tax_rates
 * table, which admins edit at /admin/tax.
 *
 * The rules:
 *
 * 1. Checkout finds the address's county and city with the US Census
 *    geocoder. countyFips is the 5-digit county code (Jefferson County is
 *    "08059"). placeGeoid is the 7-digit city code (Lakewood is "0843000"),
 *    or null when the address is outside any city.
 * 2. The rows that apply are the county row with that code, plus the city row
 *    with that code when there is one. Special districts are never added:
 *    the geocoder can't tell whether an address is inside one.
 * 3. If the county, or the city when there is one, has no row, the answer is
 *    "unknown". Checkout must not guess a rate: it charges no local tax.
 * 4. If any row that applies isn't marked confirmed, the answer is
 *    "unconfirmed". Checkout must not charge tax from it: it charges no
 *    local tax, as for "unknown".
 * 5. Otherwise the answer is "ok", and the rate is the sum of the food rates
 *    of the rows that apply and tax food. Wheat Ridge (3.5%) in Jefferson
 *    County (0.5%) comes to 4.0%. Denver and Broomfield are each one city and
 *    county: their whole rate sits on one row, and the other is 0%.
 * 6. Whatever the answer, maybeInDistrict is true for Jefferson and Douglas
 *    County addresses. Those counties hold local improvement districts that
 *    tax food (Southeast Jefferson County and Lincoln Station). Checkout
 *    doesn't act on it: Jesse chose to charge only the city and county rates.
 */

/** Counties that hold a special district with its own food tax. */
const DISTRICT_COUNTIES = new Set(["08059", "08035"]); // Jefferson, Douglas

export interface FoodTaxPart {
  id: number;
  kind: FoodTaxKind;
  name: string;
  censusGeoid: string | null;
  taxesFood: boolean;
  /** The food rate in hundredths of a percent (0 when food is exempt). */
  rateBps: number;
  confirmed: boolean;
  /** Who collects it: the state, the city itself, or nobody (null). */
  collectedBy: FoodTaxCollector | null;
}

export type FoodTaxLookup =
  | {
      status: "ok";
      /** Total food rate in hundredths of a percent (400 = 4.00%). */
      rateBps: number;
      /** For the order record, like "Wheat Ridge, Jefferson County". */
      jurisdiction: string;
      parts: FoodTaxPart[];
      maybeInDistrict: boolean;
    }
  | {
      status: "unconfirmed";
      jurisdiction: string;
      parts: FoodTaxPart[];
      /** Names of the rows that still need an admin to confirm them. */
      unconfirmed: string[];
      maybeInDistrict: boolean;
    }
  | {
      status: "unknown";
      reason: "bad_input" | "county_not_listed" | "city_not_listed" | "lookup_failed";
      maybeInDistrict: boolean;
    };

interface FoodTaxRow {
  id: number;
  kind: FoodTaxKind;
  name: string;
  census_geoid: string | null;
  taxes_food: boolean;
  food_rate_bps: number;
  confirmed: boolean;
  collected_by: FoodTaxCollector | null;
}

function toPart(row: FoodTaxRow): FoodTaxPart {
  return {
    id: Number(row.id),
    kind: row.kind,
    name: row.name,
    censusGeoid: row.census_geoid,
    taxesFood: row.taxes_food,
    rateBps: row.food_rate_bps,
    confirmed: row.confirmed,
    collectedBy: row.collected_by,
  };
}

/**
 * Look up the food tax for an address from its Census codes. Reads with the
 * visitor's own database session; the rates are public. Pass a client to
 * read with a different one.
 */
export async function lookupFoodTax(
  { placeGeoid, countyFips }: { placeGeoid?: string | null; countyFips: string },
  client?: SupabaseClient
): Promise<FoodTaxLookup> {
  const county = (countyFips ?? "").trim();
  const place = (placeGeoid ?? "").trim() || null;
  const maybeInDistrict = DISTRICT_COUNTIES.has(county);

  if (!/^\d{5}$/.test(county) || (place !== null && !/^\d{7}$/.test(place))) {
    return { status: "unknown", reason: "bad_input", maybeInDistrict };
  }

  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("food_tax_rates")
    .select("id, kind, name, census_geoid, taxes_food, food_rate_bps, confirmed, collected_by")
    .in("census_geoid", place ? [county, place] : [county]);
  if (error || !data) {
    return { status: "unknown", reason: "lookup_failed", maybeInDistrict };
  }

  const rows = data as FoodTaxRow[];
  const countyRow = rows.find((r) => r.kind === "county" && r.census_geoid === county);
  const cityRow = place
    ? rows.find((r) => r.kind === "city" && r.census_geoid === place)
    : undefined;

  if (!countyRow) {
    return { status: "unknown", reason: "county_not_listed", maybeInDistrict };
  }
  if (place && !cityRow) {
    return { status: "unknown", reason: "city_not_listed", maybeInDistrict };
  }

  const applicable = cityRow ? [cityRow, countyRow] : [countyRow];
  const parts = applicable.map(toPart);
  const jurisdiction = cityRow
    ? `${cityRow.name}, ${countyRow.name}`
    : `${countyRow.name} (outside city limits)`;

  const unconfirmed = parts.filter((p) => !p.confirmed).map((p) => p.name);
  if (unconfirmed.length > 0) {
    return { status: "unconfirmed", jurisdiction, parts, unconfirmed, maybeInDistrict };
  }

  const rateBps = parts.reduce((sum, p) => sum + (p.taxesFood ? p.rateBps : 0), 0);
  return { status: "ok", rateBps, jurisdiction, parts, maybeInDistrict };
}
