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
 *
 * The same rules split a part refund: splitRefund (at the bottom) works out
 * its jars, fees and tax, and splitTaxCents shares its tax between places.
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

/* ---------- Part refunds ---------- */

/**
 * What a part refund was for, as Jesse answers it on the admin order page:
 * fees only (no tax), jars only (jars and their tax), some of each (he
 * types the jar price), or not sure.
 */
export type RefundFor = "fees" | "jars" | "both" | "unsure";

export interface RefundParts {
  jarsCents: number;
  feesCents: number;
  taxCents: number;
}

/**
 * The jars and tax in an amount that is jars plus their tax, such as a
 * refund of "jars only". The jar price J is the one where J plus the tax
 * checkout would charge on J (rule 1 above) comes to the amount. Rounding
 * leaves a few amounts that no jar price reaches; then J is the amount
 * divided by (1 + rate), rounded, and the tax is whatever is left, so the
 * two always add up to the amount.
 */
export function jarsAndTaxIn(amountCents: number, rateBps: number): RefundParts {
  const guess = Math.round((amountCents * 10_000) / (10_000 + rateBps));
  for (const jars of [guess, guess - 1, guess + 1]) {
    if (jars >= 0 && jars + taxOn(jars, rateBps) === amountCents) {
      return { jarsCents: jars, feesCents: 0, taxCents: amountCents - jars };
    }
  }
  const jars = Math.min(Math.max(guess, 0), amountCents);
  return { jarsCents: jars, feesCents: 0, taxCents: amountCents - jars };
}

/**
 * How a part refund splits into jars, fees and tax, from Jesse's answer.
 * rateBps is the order's total food rate (0 if it paid no tax). jarsCents
 * is the jar price he typed, used only for "both".
 *
 * Returns null for "unsure", and when the answer doesn't fit the amount:
 * for "both", a jar price of zero, or jars plus their tax above the refund.
 */
export function splitRefund(
  amountCents: number,
  rateBps: number,
  refundFor: RefundFor,
  jarsCents = 0
): RefundParts | null {
  switch (refundFor) {
    case "fees":
      return { jarsCents: 0, feesCents: amountCents, taxCents: 0 };
    case "jars":
      return jarsAndTaxIn(amountCents, rateBps);
    case "both": {
      if (!Number.isInteger(jarsCents) || jarsCents <= 0) return null;
      const taxCents = taxOn(jarsCents, rateBps);
      const feesCents = amountCents - jarsCents - taxCents;
      if (feesCents < 0) return null;
      return { jarsCents, feesCents, taxCents };
    }
    default:
      return null;
  }
}
