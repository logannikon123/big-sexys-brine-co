/**
 * What the Class sessions admin page shows, and the rules it shares with the
 * database. Safe to use in the browser and on the server.
 */

import type { ClassBooking, ClassSession } from "@/types/classes";
import type { Order, OrderStatus } from "@/types/orders";
import { statusLabel } from "@/components/admin/orders/order-flow";

/** The order fields a booking row shows. */
export type BookingOrder = Pick<
  Order,
  | "id"
  | "order_number"
  | "status"
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "total_cents"
  | "refunded_cents"
  | "refund_status"
  | "square_environment"
> & {
  /** True when Square took a card payment the site can refund. */
  has_payment: boolean;
};

export interface AdminClassBooking extends ClassBooking {
  /** Null only if the order can't be read. */
  order: BookingOrder | null;
}

export interface AdminClassSession extends ClassSession {
  /** Newest first. */
  bookings: AdminClassBooking[];
  /** Seats held by bookings, counted as class_seats_taken() counts them. */
  seatsTaken: number;
}

/** Limits on the class date form. The database checks the same ones. */
export const SEATS_MIN = 1;
export const SEATS_MAX = 50;
export const PRICE_MIN_CENTS = 100;
export const PRICE_MAX_CENTS = 100_000;
export const NAME_MAX = 120;
export const ADDRESS_MAX = 200;
/** The longest note Jesse can save when he cancels a booking. */
export const CANCEL_NOTE_MAX = 500;

const FREED_STATUSES: readonly OrderStatus[] = ["payment_failed", "cancelled"];

/**
 * Whether a booking holds its seats. The same rule as the database function
 * class_seats_taken() in supabase/migrations/20261029022312_class_booking.sql:
 * not cancelled, its order waiting on payment or paid (not failed or
 * cancelled), and not refunded in full.
 */
export function holdsSeats(booking: Pick<AdminClassBooking, "cancelled_at" | "order">): boolean {
  const order = booking.order;
  return (
    booking.cancelled_at === null &&
    order !== null &&
    !FREED_STATUSES.includes(order.status) &&
    order.refunded_cents < order.total_cents
  );
}

/** Money Square could still give back on a booking's order, in cents. */
export function refundableCents(order: BookingOrder | null): number {
  if (!order || !order.has_payment) return 0;
  if (order.status === "pending_payment" || order.status === "payment_failed") return 0;
  return Math.max(0, order.total_cents - order.refunded_cents);
}

/** A booking's order step in words. A paid class order reads "Paid", not "needs packing". */
export function bookingStatusLabel(status: OrderStatus): string {
  if (status === "paid") return "Paid";
  if (status === "fulfilled") return "Attended";
  return statusLabel(status);
}

/** "1 seat", "3 seats" */
export function seatWords(count: number): string {
  return count === 1 ? "1 seat" : `${count} seats`;
}
