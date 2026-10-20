import { z } from "zod";

/**
 * Store settings for online ordering: one row in the store_settings table.
 * Money is in whole cents (500 = $5.00), weights in ounces, box sizes in
 * inches, and the tax rate in hundredths of a percent (400 = 4.00%).
 */
export interface StoreSettings {
  orders_open: boolean;
  pickup_enabled: boolean;
  pickup_instructions: string;
  delivery_enabled: boolean;
  delivery_zip_codes: string[];
  delivery_fee_cents: number;
  delivery_min_order_cents: number;
  delivery_free_over_cents: number | null;
  delivery_instructions: string;
  shipping_enabled: boolean;
  shipping_states: string[];
  ship_from_zip: string;
  shipping_service: "ground_advantage" | "priority";
  jars_per_box: number;
  packing_fee_per_box_cents: number;
  box_length_in: number;
  box_width_in: number;
  box_height_in: number;
  empty_box_weight_oz: number;
  jar_weight_16oz_oz: number;
  jar_weight_32oz_oz: number;
  shipping_cushion_per_box_cents: number;
  shipping_fallback_per_box_cents: number;
  tax_rate_bps: number;
}

export const SHIPPING_SERVICES = [
  { value: "ground_advantage", label: "USPS Ground Advantage (cheaper, 2 to 5 days)" },
  { value: "priority", label: "USPS Priority Mail (faster, 1 to 3 days, costs more)" },
] as const;

/** The 50 states plus DC. */
export const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

const US_STATE_SET = new Set<string>(US_STATE_CODES);

/** Highest tax rate the form accepts (20%), to catch typos like 40 for 4. */
export const MAX_TAX_RATE_BPS = 2000;

const cents = (label: string) =>
  z
    .number({ error: `${label}: enter an amount in dollars.` })
    .int(`${label}: enter an amount in dollars.`)
    .min(0, `${label} can't be less than $0.`)
    .max(100_000_00, `${label} looks too high.`);

const ounces = (label: string) =>
  z
    .number({ error: `${label}: enter a whole number of ounces.` })
    .int(`${label}: enter a whole number of ounces.`)
    .min(0, `${label} can't be less than 0.`)
    .max(1600, `${label} looks too high (over 100 pounds).`);

const inches = (label: string) =>
  z
    .number({ error: `${label}: enter a size in inches.` })
    .gt(0, `${label} must be more than 0 inches.`)
    .max(999.99, `${label} looks too high.`);

export const storeSettingsSchema = z
  .object({
    orders_open: z.boolean(),
    pickup_enabled: z.boolean(),
    pickup_instructions: z.string().trim().max(2000, "Pickup instructions are too long."),
    delivery_enabled: z.boolean(),
    delivery_zip_codes: z
      .array(z.string().regex(/^\d{5}$/, "Each delivery ZIP code must be 5 digits."))
      .max(500, "That's too many delivery ZIP codes."),
    delivery_fee_cents: cents("Delivery fee"),
    delivery_min_order_cents: cents("Smallest order for delivery"),
    delivery_free_over_cents: cents("Free delivery amount").nullable(),
    delivery_instructions: z.string().trim().max(2000, "Delivery instructions are too long."),
    shipping_enabled: z.boolean(),
    shipping_states: z
      .array(
        z.string().refine((s) => US_STATE_SET.has(s), "Each state must be a two-letter code, like CO.")
      )
      .max(51, "That's too many states."),
    ship_from_zip: z
      .string()
      .regex(/^(\d{5})?$/, "The ZIP code you ship from must be 5 digits."),
    shipping_service: z.enum(["ground_advantage", "priority"], {
      error: "Pick a shipping service.",
    }),
    jars_per_box: z
      .number({ error: "Jars per box: enter a whole number." })
      .int("Jars per box: enter a whole number.")
      .min(1, "A box must hold at least 1 jar.")
      .max(100, "Jars per box looks too high."),
    packing_fee_per_box_cents: cents("Packing fee per box"),
    box_length_in: inches("Box length"),
    box_width_in: inches("Box width"),
    box_height_in: inches("Box height"),
    empty_box_weight_oz: ounces("Empty box weight"),
    jar_weight_16oz_oz: ounces("Weight of a filled 16 oz jar"),
    jar_weight_32oz_oz: ounces("Weight of a filled 32 oz jar"),
    shipping_cushion_per_box_cents: cents("Extra added to each box"),
    shipping_fallback_per_box_cents: cents("Backup shipping price per box"),
    tax_rate_bps: z
      .number({ error: "Sales tax: enter a percent, like 4 or 2.9." })
      .int("Sales tax: use at most two decimal places.")
      .min(0, "Sales tax can't be less than 0%.")
      .max(MAX_TAX_RATE_BPS, "Sales tax over 20% looks like a typo."),
  })
  .strict()
  .superRefine((s, ctx) => {
    // These only matter once customers can order, so a half-finished setup
    // can still be saved while the store is closed.
    if (!s.orders_open) return;
    if (!s.pickup_enabled && !s.delivery_enabled && !s.shipping_enabled) {
      ctx.addIssue({
        code: "custom",
        message: "To open the store, turn on at least one of pickup, local delivery or shipping.",
      });
    }
    if (s.delivery_enabled && s.delivery_zip_codes.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Local delivery is on, but no ZIP codes are listed. Add some or turn delivery off.",
      });
    }
    if (s.shipping_enabled && s.shipping_states.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Shipping is on, but no states are listed. Add some or turn shipping off.",
      });
    }
    if (s.shipping_enabled && s.ship_from_zip === "") {
      ctx.addIssue({
        code: "custom",
        message: "Shipping is on, but the ZIP code you ship from is blank.",
      });
    }
  });

/** Turn "5", "5.5", "$5.50" or "1,000" into cents. Returns null if it isn't a dollar amount. */
export function dollarsToCents(text: string): number | null {
  const cleaned = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** 500 becomes "5.00". */
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Turn "4", "4.5" or "2.9%" into hundredths of a percent. Returns null if it isn't a percent. */
export function percentToBps(text: string): number | null {
  const cleaned = text.trim().replace(/%$/, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** 400 becomes "4", 290 becomes "2.9", 881 becomes "8.81". */
export function bpsToPercent(bps: number): string {
  return String(bps / 100);
}

/** Split a typed list on commas, spaces or new lines, and drop blanks and repeats. */
export function splitList(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).filter((item) => item !== ""))];
}
