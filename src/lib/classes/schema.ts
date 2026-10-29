import { z } from "zod";
import { customerSchema } from "@/lib/checkout/schema";
import { MAX_SEATS_PER_BOOKING } from "@/types/classes";

/**
 * What the booking form sends to the booking route
 * (src/app/api/classes/book/route.ts). The price always comes from the
 * database; the total here is only what the customer saw, so a changed
 * price charges nothing.
 */
export const bookClassInputSchema = z.object({
  /** One per booking attempt, so a repeated click can't charge twice. */
  checkoutId: z.uuid(),
  sessionId: z.number().int().positive(),
  seats: z
    .number()
    .int("Pick a number of seats.")
    .min(1, "Pick at least 1 seat.")
    .max(MAX_SEATS_PER_BOOKING, `One booking can take up to ${MAX_SEATS_PER_BOOKING} seats.`),
  customer: customerSchema.extend({
    phone: z
      .string()
      .trim()
      .min(7, "Enter a phone number, in case the class changes.")
      .max(30, "The phone number is too long."),
  }),
  termsAccepted: z.literal(true, "Please agree to the class policy, terms and privacy policy to book."),
  expectedTotalCents: z.number().int().min(0),
  /** Square's one-time code for the card. */
  sourceId: z.string().min(1).max(500),
  marketingOptIn: z.boolean().optional(),
});

export type BookClassInput = z.infer<typeof bookClassInputSchema>;
