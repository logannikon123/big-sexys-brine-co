import "server-only";
import type { StoreSettings } from "@/lib/store-settings";

/**
 * The postage estimate for a shipped order.
 *
 * For now this is the flat backup price per box from Store settings, plus the
 * extra cushion per box. Live USPS prices come later, once there is a USPS
 * developer account: this function is the one place to add them, falling
 * back to the flat price when USPS doesn't answer.
 */

export type PostageMethod = "flat_backup";

export interface PostageEstimate {
  postageCents: number;
  method: PostageMethod;
}

export interface PostageRequest {
  boxes: number;
  /** Five-digit ZIP code the order ships to. */
  destinationZip: string;
  settings: Pick<
    StoreSettings,
    "shipping_fallback_per_box_cents" | "shipping_cushion_per_box_cents"
  >;
}

export async function estimatePostage(request: PostageRequest): Promise<PostageEstimate> {
  const { boxes, settings } = request;
  return {
    postageCents:
      boxes * settings.shipping_fallback_per_box_cents +
      boxes * settings.shipping_cushion_per_box_cents,
    method: "flat_backup",
  };
}
