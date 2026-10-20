/**
 * Delivery dates, counted in whole calendar days in Colorado time.
 *
 * The rule (agreed with Jesse in October 2026): a delivery date 3 or more
 * calendar days after the order date is standard, and anything sooner is a
 * rush. Tomorrow is the earliest date anyone can pick. The 3 comes from the
 * "standard delivery" hours in Store settings (72 hours = 3 days), so
 * changing that setting moves the line.
 *
 * Safe to use in the browser too, for the date picker.
 */

export const STORE_TIME_ZONE = "America/Denver";

/** The furthest ahead a customer can book a delivery. */
export const MAX_DELIVERY_DAYS_AHEAD = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Today's date in Colorado, as YYYY-MM-DD. */
export function storeDate(now: Date): string {
  // The en-CA format writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** Whole calendar days from one YYYY-MM-DD date to another. */
export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round(dayNumber(toDate) - dayNumber(fromDate));
}

/** The YYYY-MM-DD date a number of days after another. */
export function addDays(isoDate: string, days: number): string {
  return new Date((dayNumber(isoDate) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Standard delivery hours from Store settings, as whole days (72 -> 3). */
export function standardDays(standardHours: number): number {
  return Math.max(1, Math.ceil(standardHours / 24));
}

export interface DeliveryDateWindow {
  /** The order date in Colorado. */
  today: string;
  /** Earliest date a customer can pick (tomorrow). Sooner than standardFrom is a rush. */
  earliest: string;
  /** First date with no rush fee. */
  standardFrom: string;
  /** Latest date a customer can pick. */
  latest: string;
}

export function deliveryDateWindow(now: Date, standardHours: number): DeliveryDateWindow {
  const today = storeDate(now);
  return {
    today,
    earliest: addDays(today, 1),
    standardFrom: addDays(today, standardDays(standardHours)),
    latest: addDays(today, MAX_DELIVERY_DAYS_AHEAD),
  };
}

export type DeliveryDateCheck =
  | { ok: true; isRush: boolean; daysAhead: number }
  | { ok: false; reason: "too_soon" | "too_far" };

export function checkDeliveryDate(
  deliveryDate: string,
  now: Date,
  standardHours: number
): DeliveryDateCheck {
  const daysAhead = daysBetween(storeDate(now), deliveryDate);
  if (daysAhead < 1) return { ok: false, reason: "too_soon" };
  if (daysAhead > MAX_DELIVERY_DAYS_AHEAD) return { ok: false, reason: "too_far" };
  return { ok: true, isRush: daysAhead < standardDays(standardHours), daysAhead };
}
