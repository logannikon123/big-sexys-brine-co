import { z } from "zod";
import { MAX_LINES, MAX_QTY_PER_LINE } from "@/lib/cart/store";
import { US_STATE_CODES } from "@/lib/store-settings";

/**
 * What the checkout page sends to the quote route (and, later, the pay
 * route). It carries product IDs and quantities only: prices always come
 * from the database. The page can use this schema to check the form before
 * it sends anything.
 */

const US_STATES = new Set<string>(US_STATE_CODES);

export const addressSchema = z.object({
  line1: z
    .string()
    .trim()
    .min(1, "Enter a street address.")
    .max(100, "The street address is too long."),
  line2: z
    .string()
    .trim()
    .max(100, "The second address line is too long.")
    .optional(),
  city: z
    .string()
    .trim()
    .min(1, "Enter a city.")
    .max(60, "The city name is too long."),
  state: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => US_STATES.has(s), "Enter a two-letter state code, like CO."),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code."),
});

export type CheckoutAddress = z.infer<typeof addressSchema>;

/** True when "2026-10-23" is a real calendar date. */
function isRealDate(text: string): boolean {
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export const deliveryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a delivery date.")
  .refine(isRealDate, "Pick a delivery date.");

export const fulfillmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pickup") }),
  z.object({
    type: z.literal("local_delivery"),
    address: addressSchema,
    deliveryDate: deliveryDateSchema,
  }),
  z.object({
    type: z.literal("shipping"),
    address: addressSchema,
  }),
]);

export type CheckoutFulfillment = z.infer<typeof fulfillmentSchema>;

export const quoteInputSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        qty: z
          .number()
          .int("Each quantity must be a whole number.")
          .min(1, "Each quantity must be at least 1.")
          .max(MAX_QTY_PER_LINE, `Each quantity must be ${MAX_QTY_PER_LINE} or less.`),
      })
    )
    .min(1, "The cart is empty.")
    .max(MAX_LINES, `The cart can hold at most ${MAX_LINES} different products.`)
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      "Each product can appear only once in the cart."
    ),
  fulfillment: fulfillmentSchema,
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;
