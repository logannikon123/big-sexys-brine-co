import { z } from "zod";
import { MAX_TAX_RATE_BPS } from "@/lib/store-settings";

/**
 * One row of the food_tax_rates table: a county, city or special district
 * and the sales tax it charges on food. Rates are in hundredths of a percent
 * (50 = 0.50%). Anyone can read these; only admins can change them.
 *
 * This file is safe to use in the browser. The checkout lookup lives in
 * src/lib/food-tax.ts.
 */
export type FoodTaxKind = "county" | "city" | "district";

export interface FoodTaxRate {
  id: number;
  kind: FoodTaxKind;
  name: string;
  /** Census code: 5 digits for a county, 7 for a city, null for a district. */
  census_geoid: string | null;
  taxes_food: boolean;
  food_rate_bps: number;
  /** Checkout charges tax only from confirmed rows. */
  confirmed: boolean;
  source: string;
  notes: string;
  updated_at: string;
}

export const FOOD_TAX_KINDS = [
  { value: "county", label: "County" },
  { value: "city", label: "City or town" },
  { value: "district", label: "Special district" },
] as const;

export function kindLabel(kind: FoodTaxKind): string {
  return FOOD_TAX_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

/** What an admin can set on a row. */
export const foodTaxRateSchema = z
  .object({
    kind: z.enum(["county", "city", "district"], {
      error: "Pick county, city or special district.",
    }),
    name: z
      .string()
      .trim()
      .min(1, "Type the name of the place.")
      .max(100, "That name is too long."),
    census_geoid: z.string().trim().nullable(),
    taxes_food: z.boolean(),
    food_rate_bps: z
      .number({ error: "Food tax rate: enter a percent, like 3.5 or 0.43." })
      .int("Food tax rate: use at most two decimal places.")
      .min(0, "The food tax rate can't be less than 0%.")
      .max(MAX_TAX_RATE_BPS, "A food tax rate over 20% looks like a typo."),
    confirmed: z.boolean(),
    source: z.string().trim().max(500, "The source is too long."),
    notes: z.string().trim().max(2000, "The notes are too long."),
  })
  .strict()
  .transform((row) => ({
    ...row,
    census_geoid: row.census_geoid ? row.census_geoid : null,
  }))
  .superRefine((row, ctx) => {
    const code = row.census_geoid;
    if (row.kind === "district" && code !== null) {
      ctx.addIssue({
        code: "custom",
        message:
          "Leave the Census code blank for a special district. The Census can't place an address inside one.",
      });
    }
    if (row.kind === "county" && code !== null && !/^\d{5}$/.test(code)) {
      ctx.addIssue({
        code: "custom",
        message: "A county's Census code has 5 digits, like 08059 for Jefferson County.",
      });
    }
    if (row.kind === "city" && code !== null && !/^\d{7}$/.test(code)) {
      ctx.addIssue({
        code: "custom",
        message: "A city's Census code has 7 digits, like 0843000 for Lakewood.",
      });
    }
    if (!row.taxes_food && row.food_rate_bps !== 0) {
      ctx.addIssue({
        code: "custom",
        message: "This place doesn't tax food, so its food rate must be 0%.",
      });
    }
  });

export type FoodTaxRateInput = z.input<typeof foodTaxRateSchema>;

/** Split "DR 1002, page 5: https://..." into its label and its web link. */
export function splitSource(source: string): { label: string; url: string | null } {
  const match = source.match(/https?:\/\/\S+/);
  if (!match) return { label: source, url: null };
  const label = source.replace(match[0], "").replace(/[\s:]+$/, "").trim();
  return { label, url: match[0] };
}
