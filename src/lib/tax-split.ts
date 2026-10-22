/**
 * Splits an order's food tax between the places that charge it (a city and
 * its county), so the tax report can show each one on its own line.
 *
 * This file has no imports and does no I/O, so it can be checked by a plain
 * script. Money is in whole cents; rates are in hundredths of a percent.
 *
 * The rules:
 *
 * 1. The order's tax is the total rate times the jar subtotal, rounded to the
 *    nearest cent, with half a cent rounding up. Checkout has always worked
 *    it out this way (see quoteTax in src/lib/checkout/quote.ts).
 * 2. Each place's share is its own rate times the jar subtotal, rounded the
 *    same way.
 * 3. Rounding each share can leave the shares a cent over or under the
 *    order's tax. The place with the highest rate takes the difference. On a
 *    tie, the first place listed takes it (the city, since the lookup lists
 *    the city before the county).
 *
 * So the shares always add up exactly to the order's tax, and no share is
 * ever below zero.
 */

export interface TaxSplitPlace {
  /** The food rate for this place, in hundredths of a percent. 0 if food is exempt. */
  rateBps: number;
}

/** Half a cent rounds up. Amounts here are never below zero. */
function taxOn(subtotalCents: number, rateBps: number): number {
  return Math.round((subtotalCents * rateBps) / 10_000);
}

/** The order's whole tax, as checkout charges it. */
export function orderTaxCents(subtotalCents: number, rateBps: number): number {
  return taxOn(subtotalCents, rateBps);
}

/**
 * Each place's share of an order's tax, in the same order as the places.
 * The shares add up to exactly totalTaxCents.
 */
export function splitTaxCents(
  subtotalCents: number,
  places: readonly TaxSplitPlace[],
  totalTaxCents: number
): number[] {
  if (places.length === 0) return [];
  const shares = places.map((p) => taxOn(subtotalCents, p.rateBps));
  const difference = totalTaxCents - shares.reduce((sum, s) => sum + s, 0);
  if (difference !== 0) {
    let largest = 0;
    for (let i = 1; i < places.length; i++) {
      if (places[i].rateBps > places[largest].rateBps) largest = i;
    }
    shares[largest] += difference;
  }
  return shares;
}
