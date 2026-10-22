import type { StoreSettings } from "@/lib/store-settings";

/** The store settings the delivery fee depends on. */
export type DeliveryFeeSettings = Pick<
  StoreSettings,
  | "delivery_max_miles"
  | "delivery_step_miles"
  | "delivery_fee_per_step_cents"
  | "rush_fee_cents"
  | "free_delivery_enabled"
  | "free_delivery_max_miles"
  | "free_delivery_min_order_cents"
>;

export interface DeliveryFee {
  /** False when the customer is too far away (or the distance is unknown). */
  inArea: boolean;
  /** The distance fee charged. 0 when free delivery applies. */
  stepFeeCents: number;
  /** The rush fee charged. 0 when the date isn't a rush. */
  rushFeeCents: number;
  /** True when free delivery waived the distance fee. */
  freeDeliveryApplied: boolean;
  /** stepFeeCents plus rushFeeCents. */
  totalFeeCents: number;
}

// Small allowance so floating-point noise (like 12.000000000001) doesn't
// push a customer into the next step or out of the area.
const EPSILON = 1e-9;

const OUT_OF_AREA: DeliveryFee = {
  inArea: false,
  stepFeeCents: 0,
  rushFeeCents: 0,
  freeDeliveryApplied: false,
  totalFeeCents: 0,
};

/**
 * The delivery fee for one order.
 *
 * The distance fee is a set price for each started step of miles, one way
 * from the store's starting point. Every delivery pays at least one step.
 * With $5 per 6 miles and a 24-mile limit:
 *
 *   5 mi    -> 1 step  -> $5
 *   6 mi    -> 1 step  -> $5
 *   6.1 mi  -> 2 steps -> $10
 *   24 mi   -> 4 steps -> $20
 *   24.1 mi -> out of area, no delivery
 *
 * A rush date adds the rush fee. Free delivery, when it is on, needs both
 * conditions (close enough AND a big enough order) and waives only the
 * distance fee: a free delivery on a rush date still pays the rush fee.
 *
 * @param miles one-way driving distance in miles
 * @param subtotalCents order subtotal in cents, before delivery and tax
 * @param rush whether the chosen date is a rush (see isRush)
 */
export function calculateDeliveryFee(
  miles: number,
  subtotalCents: number,
  rush: boolean,
  settings: DeliveryFeeSettings
): DeliveryFee {
  if (!Number.isFinite(miles) || miles < 0) return OUT_OF_AREA;
  if (miles > settings.delivery_max_miles + EPSILON) return OUT_OF_AREA;

  const steps = Math.max(
    1,
    Math.ceil(miles / settings.delivery_step_miles - EPSILON)
  );

  const freeDeliveryApplied =
    settings.free_delivery_enabled &&
    settings.free_delivery_max_miles !== null &&
    settings.free_delivery_min_order_cents !== null &&
    miles <= settings.free_delivery_max_miles + EPSILON &&
    subtotalCents >= settings.free_delivery_min_order_cents;

  const stepFeeCents = freeDeliveryApplied
    ? 0
    : steps * settings.delivery_fee_per_step_cents;
  const rushFeeCents = rush ? settings.rush_fee_cents : 0;

  return {
    inArea: true,
    stepFeeCents,
    rushFeeCents,
    freeDeliveryApplied,
    totalFeeCents: stepFeeCents + rushFeeCents,
  };
}

/**
 * True when the delivery date comes sooner than the standard window after
 * the order. With a 72-hour window, an order placed Monday at 10 a.m. is a
 * rush for any delivery time before Thursday at 10 a.m.
 *
 * Checkout decides what time stands for a chosen calendar date (for example
 * the end of that day) before it calls this.
 */
export function isRush(
  orderTime: Date,
  deliveryDate: Date,
  standardHours: number
): boolean {
  const standardMs = standardHours * 60 * 60 * 1000;
  return deliveryDate.getTime() < orderTime.getTime() + standardMs;
}
