import { z } from "zod";

/**
 * What the admin form sends when it saves a retail location (a store that
 * carries the jars, shown on the Find Us page). Blank hours or image become
 * null.
 */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional()
    .transform((s) => s ?? null);

export const retailLocationSchema = z.object({
  name: z.string().trim().min(1, "Enter the store's name.").max(100, "The name is too long."),
  address: z
    .string()
    .trim()
    .min(1, "Enter the store's street address.")
    .max(200, "The address is too long."),
  hours: optionalText(200, "The hours are too long."),
  image_url: optionalText(1000, "The image link is too long").refine(
    (url) => url === null || /^https:\/\//.test(url),
    "The image link must start with https://."
  ),
  is_pickup_location: z.boolean(),
  is_visible: z.boolean(),
});

export type RetailLocationInput = z.input<typeof retailLocationSchema>;
