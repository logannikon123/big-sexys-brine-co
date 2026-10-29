/**
 * Rows for the Learn to Preserve class
 * (supabase/migrations/20261029022312_class_booking.sql). Field names match
 * the database columns. Money is in whole cents and times arrive as ISO
 * strings.
 *
 * Only admins can read these tables. Visitors get upcoming dates and seats
 * left from the upcoming_class_sessions() function.
 */

/** One class date, added by an admin. */
export interface ClassSession {
  id: number;
  starts_at: string;
  ends_at: string;
  location_name: string;
  location_address: string | null;
  /** How many people the session holds. */
  seats: number;
  /** Price per seat. */
  price_cents: number;
  /** False hides the session from the class page and stops new bookings. */
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

/** What visitors see for an upcoming session. */
export interface PublicClassSession {
  id: number;
  starts_at: string;
  ends_at: string;
  location_name: string;
  location_address: string | null;
  seats: number;
  price_cents: number;
  seats_left: number;
  /** False within 24 hours of the start, when booking has closed. */
  booking_open: boolean;
}

/** One booking. The order it points to holds the customer and the money. */
export interface ClassBooking {
  id: string;
  order_id: string;
  session_id: number;
  seats: number;
  /** Set when Jesse cancels the booking. Frees the seats. */
  cancelled_at: string | null;
  cancel_note: string | null;
  created_at: string;
}

/** The most seats one booking can take. The database checks it too. */
export const MAX_SEATS_PER_BOOKING = 4;

/** Seats a new session starts with (Jesse, 2026-10-28). */
export const DEFAULT_SESSION_SEATS = 6;

/** Bookings close this many hours before a class starts. The database checks it too. */
export const BOOKING_CLOSES_HOURS = 24;

/** A full refund is due when a booking is cancelled at least this many days before class. */
export const FULL_REFUND_DAYS = 7;

/** Each paid booking earns a code worth this much off one jar order. */
export const CLASS_DISCOUNT_PERCENT = 10;

/** How long a class discount code works, in months after it is sent. */
export const CLASS_DISCOUNT_MONTHS = 6;
